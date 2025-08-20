// server/routers/admin.ts
import type { Express, Request } from "express";
import { db } from "../db";
import {
  activities,
  listings,
  payments,
  users,
  type User,
} from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";

/* --- helpers: auth (مبسّط) --- */
async function resolveActor(req: Request): Promise<User | undefined> {
  const userId = (req as any)?.session?.userId || (req.query.userId as string | undefined);
  const telegramId = req.query.telegramId as string | undefined;

  if (userId) {
    const rows = await db.select().from(users).where(eq(users.id, String(userId))).limit(1);
    return rows[0];
  }
  if (telegramId) {
    const rows = await db.select().from(users).where(eq(users.telegramId, String(telegramId))).limit(1);
    return rows[0];
  }
  return undefined;
}
function isAdmin(u?: Pick<User, "role" | "username">) {
  const uname = (u?.username ?? "").toLowerCase();
  return u?.role === "admin" || uname === "os6s7";
}

/* --- Telegram notify helper --- */
async function notify(telegramId: string | null | undefined, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const chatId = telegramId ? Number(telegramId) : NaN;
  if (!Number.isFinite(chatId)) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch {
    // ignore
  }
}

export function mountAdmin(app: Express) {
  // ✅ جميع الطلبات (kind='order' فقط)
  app.get("/api/admin/orders", async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    // طلبات الشراء فقط + لها listingId
    const rows = await db
      .select({
        id: payments.id,
        listingId: payments.listingId,
        createdAt: payments.createdAt,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        adminAction: payments.adminAction,
        buyerId: payments.buyerId,
        escrowAddress: payments.escrowAddress,
        sellerId: listings.sellerId,
      })
      .from(payments)
      .innerJoin(listings, eq(listings.id, payments.listingId))
      .where(eq(payments.kind, "order"))
      .orderBy(desc(payments.createdAt));

    if (rows.length === 0) return res.json([]);

    // جلب بيانات المشترين والبائعين
    const buyerIds = Array.from(new Set(rows.map(r => r.buyerId)));
    const sellerIds = Array.from(new Set(rows.map(r => r.sellerId)));
    const allUserIds = Array.from(new Set([...buyerIds, ...sellerIds]));

    const usersRows = allUserIds.length
      ? await db.select().from(users).where(eq(users.id, allUserIds[0])).then(async first =>
          allUserIds.length === 1 ? first : await db.select().from(users).where(
            // drizzle ما يدعم IN مباشرة هنا بدون helpers، فنبقيها بسيطة باستعلامات متعددة عند الحاجة
            // لكن لتقليل الاستعلامات، نرجع لاستعلام واحد لكل id (صغير العدد عادة)
            // إذا تحب IN: استعمل sql`... IN (...)`
            // للحفاظ على البساطة والtype-safety نكرر:
            // ملاحظة: لتحسين الأداء استبدلها بـ sql in.
            // ندمج النتائج:
            Promise.all(allUserIds.map(async id => (await db.select().from(users).where(eq(users.id, id)).limit(1))[0]))
          )
        )
      : [];

    const flatUsers = Array.isArray(usersRows) ? usersRows.flat() : usersRows;
    const U = new Map(flatUsers.filter(Boolean).map(u => [u.id, u]));

    const out = rows.map(r => {
      const buyer = U.get(r.buyerId);
      const seller = U.get(r.sellerId);

      // mapping: paid/pending = held, completed+payout = released, refunded = refunded, disputed = disputed, cancelled = cancelled
      const status:
        | "held"
        | "awaiting_buyer_confirm"
        | "disputed"
        | "released"
        | "refunded"
        | "cancelled" =
        r.status === "disputed" ? "disputed"
        : r.status === "refunded" ? "refunded"
        : r.status === "cancelled" ? "cancelled"
        : (r.status === "completed" && r.adminAction === "payout") ? "released"
        : "held";

      return {
        id: r.id,
        listingId: r.listingId,
        createdAt: r.createdAt as unknown as string,
        amount: String(r.amount),
        currency: (r.currency as string) || "TON",
        status,
        buyer: { id: r.buyerId, username: buyer?.username ?? null, name: buyer?.firstName ?? null },
        seller: { id: r.sellerId, username: seller?.username ?? null, name: seller?.firstName ?? null },
        unlockAt: null,
        thread: [] as unknown[],
      };
    });

    res.json(out);
  });

  // ✅ Release: تحويل الحالة فقط، بدون إرسال فعلي
  app.post("/api/admin/payments/:id/release", async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    const pid = req.params.id;
    const pay = (await db.select().from(payments).where(eq(payments.id, pid)).limit(1))[0];
    if (!pay) return res.status(404).json({ error: "Payment not found" });
    if (pay.kind !== "order") return res.status(400).json({ error: "Not an order payment" });

    // حالات مُغلقة لا تُعدّل
    if (pay.status === "refunded") return res.status(409).json({ error: "Already refunded" });
    if (pay.status === "completed" && pay.adminAction === "payout") {
      return res.status(409).json({ error: "Already released" });
    }

    await db
      .update(payments)
      .set({ status: "completed", adminAction: "payout", confirmedAt: new Date() })
      .where(eq(payments.id, pid));

    const listing = pay.listingId
      ? (await db.select().from(listings).where(eq(listings.id, pay.listingId)).limit(1))[0]
      : undefined;

    if (listing) {
      await db.insert(activities).values({
        listingId: listing.id,
        buyerId: pay.buyerId,
        sellerId: listing.sellerId,
        paymentId: pay.id,
        type: "admin_release",
        status: "completed",
        amount: pay.amount,
        currency: pay.currency,
        note: "Admin released funds to seller",
      });
    }

    const buyer = (await db.select().from(users).where(eq(users.id, pay.buyerId)).limit(1))[0];
    const seller = listing ? (await db.select().from(users).where(eq(users.id, listing.sellerId)).limit(1))[0] : undefined;

    await notify(buyer?.telegramId, `✅ <b>Order Released</b>\nYour payment was released to the seller.`);
    await notify(seller?.telegramId, `✅ <b>Payout Approved</b>\nAdmin has released the funds to your wallet.`);

    res.json({ ok: true });
  });

  // ✅ Refund
  app.post("/api/admin/payments/:id/refund", async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    const pid = req.params.id;
    const pay = (await db.select().from(payments).where(eq(payments.id, pid)).limit(1))[0];
    if (!pay) return res.status(404).json({ error: "Payment not found" });
    if (pay.kind !== "order") return res.status(400).json({ error: "Not an order payment" });

    if (pay.status === "completed" && pay.adminAction === "payout") {
      return res.status(409).json({ error: "Already released" });
    }
    if (pay.status === "refunded") {
      return res.status(409).json({ error: "Already refunded" });
    }

    await db
      .update(payments)
      .set({ status: "refunded", adminAction: "refund", confirmedAt: new Date() })
      .where(eq(payments.id, pid));

    const listing = pay.listingId
      ? (await db.select().from(listings).where(eq(listings.id, pay.listingId)).limit(1))[0]
      : undefined;

    if (listing) {
      await db.insert(activities).values({
        listingId: listing.id,
        buyerId: pay.buyerId,
        sellerId: listing.sellerId,
        paymentId: pay.id,
        type: "admin_refund",
        status: "completed",
        amount: pay.amount,
        currency: pay.currency,
        note: "Admin refunded buyer",
      });
    }

    const buyer = (await db.select().from(users).where(eq(users.id, pay.buyerId)).limit(1))[0];
    const seller = listing ? (await db.select().from(users).where(eq(users.id, listing.sellerId)).limit(1))[0] : undefined;

    await notify(buyer?.telegramId, `↩️ <b>Refund Approved</b>\nAdmin has refunded your payment.`);
    await notify(seller?.telegramId, `⚠️ <b>Order Refunded</b>\nAdmin refunded the buyer for this order.`);

    res.json({ ok: true });
  });
}