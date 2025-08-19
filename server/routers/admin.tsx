// server/routers/admin.ts
import type { Express } from "express";
import { db } from "../db";
import { activities, listings, payments, users } from "@shared/schema";
import { and, desc, eq, or } from "drizzle-orm";

/* --- helpers: auth (مبسّط) --- */
async function resolveActor(req: any) {
  const userId = (req as any).session?.userId || req.query.userId;
  const telegramId = req.query.telegramId;
  if (userId) return (await db.select().from(users).where(eq(users.id, String(userId))).limit(1))[0];
  if (telegramId) return (await db.select().from(users).where(eq(users.telegramId, String(telegramId))).limit(1))[0];
  return undefined;
}
function isAdmin(u?: { role?: string; username?: string | null }) {
  const uname = (u?.username || "").toLowerCase();
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
  } catch {}
}

export function mountAdmin(app: Express) {
  // ✅ جلب جميع الطلبات للإدمن
  app.get("/api/admin/orders", async (req, res) => {
    try {
      const actor = await resolveActor(req);
      if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

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
        .orderBy(desc(payments.createdAt));

      if (rows.length === 0) return res.json([]);

      const buyerIds = Array.from(new Set(rows.map(r => r.buyerId)));
      const sellerIds = Array.from(new Set(rows.map(r => r.sellerId)));
      const allUserIds = Array.from(new Set([...buyerIds, ...sellerIds]));

      let usersRows: typeof users.$inferSelect[] = [];
      if (allUserIds.length === 1) {
        usersRows = await db.select().from(users).where(eq(users.id, allUserIds[0]));
      } else if (allUserIds.length > 1) {
        usersRows = await db
          .select()
          .from(users)
          .where(or(...allUserIds.map(id => eq(users.id, id))));
      }

      const U = new Map(usersRows.map(u => [u.id, u]));
      const out = rows.map((r) => {
        const buyer = U.get(r.buyerId);
        const seller = U.get(r.sellerId);
        let status: "held" | "awaiting_buyer_confirm" | "disputed" | "released" | "refunded" | "cancelled" =
          r.status === "disputed" ? "disputed"
          : r.status === "refunded" ? "refunded"
          : r.status === "cancelled" ? "cancelled"
          : r.status === "completed" ? "released"
          : "held";

        return {
          id: r.id,
          listingId: r.listingId,
          createdAt: r.createdAt as unknown as string,
          amount: String(r.amount),
          currency: (r.currency as any) || "TON",
          status,
          buyer: { id: r.buyerId, username: buyer?.username ?? null, name: buyer?.firstName ?? null },
          seller: { id: r.sellerId, username: seller?.username ?? null, name: seller?.firstName ?? null },
          unlockAt: null,
          thread: [],
        };
      });

      res.json(out);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "failed to load orders" });
    }
  });

  // ✅ قرار الإدمن: Release (تحويل الحالة فقط، بدون إرسال فعلي)
  app.post("/api/admin/payments/:id/release", async (req, res) => {
    try {
      const actor = await resolveActor(req);
      if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

      const pid = req.params.id;
      const pay = (await db.select().from(payments).where(eq(payments.id, pid)).limit(1))[0];
      if (!pay) return res.status(404).json({ error: "Payment not found" });

      // حالات مُغلقة لا يجوز تعديلها
      if (["refunded", "cancelled"].includes(pay.status as any)) {
        return res.status(409).json({ error: `Payment already ${pay.status}` });
      }
      if (pay.status === "completed" && pay.adminAction === "payout") {
        return res.status(409).json({ error: "Already released" });
      }

      await db
        .update(payments)
        .set({ status: "completed", adminAction: "payout", confirmedAt: new Date() as any })
        .where(eq(payments.id, pid));

      const listing = (await db.select().from(listings).where(eq(listings.id, pay.listingId)).limit(1))[0];
      await db.insert(activities).values({
        listingId: pay.listingId,
        buyerId: pay.buyerId,
        sellerId: listing.sellerId,
        paymentId: pay.id,
        type: "admin_release",
        status: "completed",
        amount: pay.amount,
        currency: pay.currency,
        note: "Admin released funds to seller",
      });

      const buyer = (await db.select().from(users).where(eq(users.id, pay.buyerId)).limit(1))[0];
      const seller = (await db.select().from(users).where(eq(users.id, listing.sellerId)).limit(1))[0];

      await notify(buyer?.telegramId, `✅ <b>Order Released</b>\nYour payment was released to the seller.`);
      await notify(seller?.telegramId, `✅ <b>Payout Approved</b>\nAdmin has released the funds to your wallet.`);

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "release failed" });
    }
  });

  // ✅ قرار الإدمن: Refund
  app.post("/api/admin/payments/:id/refund", async (req, res) => {
    try {
      const actor = await resolveActor(req);
      if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

      const pid = req.params.id;
      const pay = (await db.select().from(payments).where(eq(payments.id, pid)).limit(1))[0];
      if (!pay) return res.status(404).json({ error: "Payment not found" });

      if (["completed", "cancelled"].includes(pay.status as any) && pay.adminAction === "payout") {
        return res.status(409).json({ error: "Already released" });
      }
      if (pay.status === "refunded") {
        return res.status(409).json({ error: "Already refunded" });
      }

      await db
        .update(payments)
        .set({ status: "refunded", adminAction: "refund", confirmedAt: new Date() as any })
        .where(eq(payments.id, pid));

      const listing = (await db.select().from(listings).where(eq(listings.id, pay.listingId)).limit(1))[0];
      await db.insert(activities).values({
        listingId: pay.listingId,
        buyerId: pay.buyerId,
        sellerId: listing.sellerId,
        paymentId: pay.id,
        type: "admin_refund",
        status: "completed",
        amount: pay.amount,
        currency: pay.currency,
        note: "Admin refunded buyer",
      });

      const buyer = (await db.select().from(users).where(eq(users.id, pay.buyerId)).limit(1))[0];
      const seller = (await db.select().from(users).where(eq(users.id, listing.sellerId)).limit(1))[0];

      await notify(buyer?.telegramId, `↩️ <b>Refund Approved</b>\nAdmin has refunded your payment.`);
      await notify(seller?.telegramId, `⚠️ <b>Order Refunded</b>\nAdmin refunded the buyer for this order.`);

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "refund failed" });
    }
  });
}