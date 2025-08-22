// server/routers/admin.ts
import type { Express, Request } from "express";
import { db } from "../db";
import { activities, listings, payments, users, type User } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { tgAuth } from "../middleware/tgAuth";
import { storage } from "../storage";

/* ---------- admin auth (via Telegram) ---------- */
const ADMIN_TG = new Set(
  (process.env.ADMIN_TG_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

async function resolveActor(req: Request): Promise<User | undefined> {
  const tg = (req as any).telegramUser as { id: number } | undefined;
  if (!tg) return undefined;
  return storage.getUserByTelegramId(String(tg.id));
}
function isAdmin(u?: Pick<User, "role" | "telegramId" | "username">) {
  if (!u) return false;
  if (u.role === "admin") return true;
  const ok = u.telegramId ? ADMIN_TG.has(u.telegramId) : false;
  return ok || (u.username || "").toLowerCase() === "os6s7";
}

/* ---------- Telegram notify helper ---------- */
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
  } catch { /* ignore */ }
}

export function mountAdmin(app: Express) {
  /* =========================
     GET /api/admin/orders
     (kind = 'order' only)
  ========================= */
  app.get("/api/admin/orders", tgAuth, async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    // نعتمد على payments فقط (usernames داخل الجدول)
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
        buyerUsername: payments.buyerUsername,
        sellerUsername: payments.sellerUsername,
        escrowAddress: payments.escrowAddress,
      })
      .from(payments)
      .where(eq(payments.kind, "order"))
      .orderBy(desc(payments.createdAt));

    if (!rows.length) return res.json([]);

    // نجلب بيانات المستخدمين اختيارياً (للتلغرام)
    const buyerIds = Array.from(new Set(rows.map(r => r.buyerId).filter(Boolean) as string[]));
    const buyers = buyerIds.length
      ? await db.select().from(users).where(eq(users.id, buyerIds[0])).execute()
      : [];
    const buyersMap = new Map(buyers.map(u => [u.id, u]));

    // seller via username (قد لا نحتاج ID هنا)
    // نجلب بعض معلومات اللستنج لعرض أفضل إن لزم
    const out = await Promise.all(rows.map(async (r) => {
      let listingTitle: string | null = null;
      let listingUsername: string | null = null;
      if (r.listingId) {
        const l = (await db.select().from(listings).where(eq(listings.id, r.listingId)).limit(1))[0];
        if (l) {
          listingTitle = l.title ?? null;
          listingUsername = l.username ?? null;
        }
      }

      const buyer = buyersMap.get(r.buyerId);
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
        listingTitle,
        listingUsername,
        createdAt: r.createdAt as unknown as string,
        amount: String(r.amount),
        currency: (r.currency as string) || "TON",
        status,
        buyer: {
          id: r.buyerId,
          username: r.buyerUsername ?? buyer?.username ?? null,
          name: buyer?.firstName ?? null,
        },
        seller: {
          username: r.sellerUsername ?? null,
        },
        escrowAddress: r.escrowAddress ?? null,
      };
    }));

    res.json(out);
  });

  /* =========================
     POST /api/admin/payments/:id/release
     (mark completed + adminAction=payout)
  ========================= */
  app.post("/api/admin/payments/:id/release", tgAuth, async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    const pid = req.params.id;
    const pay = (await db.select().from(payments).where(eq(payments.id, pid)).limit(1))[0];
    if (!pay) return res.status(404).json({ error: "Payment not found" });
    if (pay.kind !== "order") return res.status(400).json({ error: "Not an order payment" });
    if (pay.status === "refunded") return res.status(409).json({ error: "Already refunded" });
    if (pay.status === "completed" && pay.adminAction === "payout") {
      return res.status(409).json({ error: "Already released" });
    }

    await db
      .update(payments)
      .set({ status: "completed", adminAction: "payout", confirmedAt: new Date() })
      .where(eq(payments.id, pid));

    // جلب listing (اختياري لكتابة activity)
    const listing = pay.listingId
      ? (await db.select().from(listings).where(eq(listings.id, pay.listingId)).limit(1))[0]
      : undefined;

    // تحديد seller عبر username
    let sellerUserId: string | undefined;
    if (pay.sellerUsername) {
      const seller = (await db.select().from(users).where(eq(users.username, pay.sellerUsername)).limit(1))[0];
      sellerUserId = seller?.id;
    }

    if (listing && sellerUserId) {
      await db.insert(activities).values({
        listingId: listing.id,
        buyerId: pay.buyerId,
        sellerId: sellerUserId,
        paymentId: pay.id,
        buyerUsername: pay.buyerUsername ?? null,
        sellerUsername: pay.sellerUsername ?? null,
        type: "admin_release",
        status: "completed",
        amount: pay.amount,
        currency: pay.currency,
        note: "Admin released funds to seller",
      });
    }

    const buyer = (await db.select().from(users).where(eq(users.id, pay.buyerId)).limit(1))[0];
    const seller =
      pay.sellerUsername
        ? (await db.select().from(users).where(eq(users.username, pay.sellerUsername)).limit(1))[0]
        : undefined;

    await notify(buyer?.telegramId, `✅ <b>Order Released</b>\nYour payment was released to the seller.`);
    await notify(seller?.telegramId, `✅ <b>Payout Approved</b>\nAdmin has released the funds to your wallet.`);

    res.json({ ok: true });
  });

  /* =========================
     POST /api/admin/payments/:id/refund
     (mark refunded + activity)
  ========================= */
  app.post("/api/admin/payments/:id/refund", tgAuth, async (req, res) => {
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

    let sellerUserId: string | undefined;
    if (pay.sellerUsername) {
      const seller = (await db.select().from(users).where(eq(users.username, pay.sellerUsername)).limit(1))[0];
      sellerUserId = seller?.id;
    }

    if (listing && sellerUserId) {
      await db.insert(activities).values({
        listingId: listing.id,
        buyerId: pay.buyerId,
        sellerId: sellerUserId,
        paymentId: pay.id,
        buyerUsername: pay.buyerUsername ?? null,
        sellerUsername: pay.sellerUsername ?? null,
        type: "admin_refund",
        status: "completed",
        amount: pay.amount,
        currency: pay.currency,
        note: "Admin refunded buyer",
      });
    }

    const buyer = (await db.select().from(users).where(eq(users.id, pay.buyerId)).limit(1))[0];
    const seller =
      pay.sellerUsername
        ? (await db.select().from(users).where(eq(users.username, pay.sellerUsername)).limit(1))[0]
        : undefined;

    await notify(buyer?.telegramId, `↩️ <b>Refund Approved</b>\nAdmin has refunded your payment.`);
    await notify(seller?.telegramId, `⚠️ <b>Order Refunded</b>\nAdmin refunded the buyer for this order.`);

    res.json({ ok: true });
  });
}