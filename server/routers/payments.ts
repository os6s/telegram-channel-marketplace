// server/routers/payments.ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db.js";
import {
  payments,
  listings,
  users,
  activities,
  insertPaymentSchema,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireTelegramUser } from "../middleware/tgAuth.js";
import { tgSendMessage, notifyAdmin } from "../utils/telegram.js";

/* ========= helpers ========= */
const toNum = (v: unknown) => Number(String(v).replace(",", "."));
const feeCalc = (amount: number, feePercent: number) => {
  const fee = +((amount * feePercent) / 100).toFixed(8);
  const sellerAmount = +(amount - fee).toFixed(8);
  return { fee, sellerAmount };
};

async function getOrCreateUserByTelegramId(tg: { id: number; username?: string }) {
  const tgId = Number(tg.id);
  const existing = await db.query.users.findFirst({ where: eq(users.telegramId, tgId) });
  if (existing) return existing;

  const inserted = await db
    .insert(users)
    .values({
      telegramId: tgId,
      username: tg.username ?? null,
      role: "user",
    })
    .returning();
  return inserted[0];
}

const webAppUrl = (process.env.WEBAPP_URL || "").trim();

/* ========= routes ========= */
export function mountPayments(app: Express) {
  /**
   * POST /api/payments
   * إنشاء طلب شراء (order) مع حفظه بالـ IDs فقط + إشعار البائع
   * body: { listingId: uuid, comment?: string }
   */
  app.post("/api/payments", requireTelegramUser, async (req: Request, res: Response) => {
    try {
      const escrowAddress = (process.env.ESCROW_WALLET || "").trim();
      if (!escrowAddress) return res.status(500).json({ error: "ESCROW_WALLET not set" });

      const feePercent = Number(process.env.FEE_PERCENT || "5");

      // المشتري الحالي من تيليجرام
      const tg = req.telegramUser!;
      const buyer = await getOrCreateUserByTelegramId({ id: tg.id, username: tg.username });

      // الإعلان
      const listingId = String(req.body?.listingId || "");
      if (!listingId) return res.status(400).json({ error: "listingId required" });

      const listing = await db.query.listings.findFirst({ where: eq(listings.id, listingId) });
      if (!listing || listing.isActive === false) {
        return res.status(400).json({ error: "listing_not_found_or_inactive" });
      }

      // البائع من الإعلان
      const sellerId = listing.sellerId;
      const seller = await db.query.users.findFirst({ where: eq(users.id, sellerId) });
      if (!seller) return res.status(400).json({ error: "seller_not_found" });

      const amount = toNum(listing.price);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "invalid_listing_price" });
      }

      // حساب عمولة
      const { fee, sellerAmount } = feeCalc(amount, feePercent);

      // تحضير وإدخال الدفع
      const draft = insertPaymentSchema.parse({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amount: String(amount),
        currency: listing.currency || "TON",
        feePercent: String(feePercent),
        comment: req.body?.comment ?? undefined,
        escrowAddress,
      });

      const created = await db
        .insert(payments)
        .values({
          listingId: draft.listingId ?? null,
          buyerId: draft.buyerId,
          sellerId: draft.sellerId,
          amount: draft.amount as any,
          currency: draft.currency || "TON",
          feePercent: (draft.feePercent as any) ?? ("5.00" as any),
          feeAmount: String(fee) as any,
          sellerAmount: String(sellerAmount) as any,
          escrowAddress: draft.escrowAddress || escrowAddress,
          txHash: draft.txHash || null,
          buyerConfirmed: false,
          sellerConfirmed: false,
          status: "pending",
          adminAction: "none",
          comment: draft.comment || null,
          locked: true,
        })
        .returning();

      const paymentRow = created[0];

      // Activity: buy
      await db.insert(activities).values({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        paymentId: paymentRow.id,
        type: "buy",
        status: "pending",
        amount: String(amount) as any,
        currency: paymentRow.currency,
        txHash: null,
        note: {} as any,
      });

      // إشعار البائع
      const titleOrHandle = listing.title || (listing.username ? `@${listing.username}` : listing.id);
      const sellerMsg =
        `🛒 <b>Order opened</b>\n` +
        `Listing: ${titleOrHandle}\n` +
        `Amount: ${amount} ${paymentRow.currency}\n` +
        (buyer.username ? `Buyer: @${buyer.username}\n` : ``) +
        `Please follow up in the app.`;
      if (seller.telegramId) {
        await tgSendMessage(seller.telegramId, sellerMsg, webAppUrl
          ? { inline_keyboard: [[{ text: "Open Marketplace", web_app: { url: webAppUrl } }]] }
          : undefined
        );
      } else {
        await notifyAdmin?.(`Seller has no telegramId. listingId=${listing.id}, sellerId=${seller.id}`);
      }

      // إشعار المشتري (اختياري)
      if (buyer.telegramId) {
        const buyerMsg =
          `✅ <b>Order created</b>\n` +
          `Listing: ${titleOrHandle}\n` +
          `Amount: ${amount} ${paymentRow.currency}\n` +
          `We’ve notified the seller. You can chat in the dispute thread if needed.`;
        await tgSendMessage(buyer.telegramId, buyerMsg, webAppUrl
          ? { inline_keyboard: [[{ text: "Open Marketplace", web_app: { url: webAppUrl } }]] }
          : undefined
        );
      }

      return res.status(201).json(paymentRow);
    } catch (e: any) {
      console.error("POST /api/payments error:", e);
      return res.status(400).json({ error: e?.message || "invalid_payload" });
    }
  });

  /**
   * PATCH /api/payments/:id/confirm
   * تأكيد الدفع من المشتري → paid + Activity + إشعار الطرفين
   */
  app.patch("/api/payments/:id/confirm", requireTelegramUser, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || "");
      if (!id) return res.status(400).json({ error: "id required" });

      // المشتري الحالي
      const tg = req.telegramUser!;
      const me = await getOrCreateUserByTelegramId({ id: tg.id, username: tg.username });

      // الدفع
      const pay = await db.query.payments.findFirst({ where: eq(payments.id, id) });
      if (!pay) return res.status(404).json({ error: "payment_not_found" });
      if (pay.status !== "pending") return res.status(400).json({ error: "payment_not_pending" });

      // السماح فقط للمشتري
      if (pay.buyerId !== me.id) return res.status(403).json({ error: "forbidden" });

      // تحديث الحالة
      const updated = await db
        .update(payments)
        .set({ status: "paid", confirmedAt: new Date() as any })
        .where(eq(payments.id, id))
        .returning();
      const up = updated[0];

      // Activity
      await db.insert(activities).values({
        listingId: pay.listingId ?? null,
        buyerId: pay.buyerId,
        sellerId: pay.sellerId,
        paymentId: pay.id,
        type: "buyer_confirm",
        status: "completed",
        amount: String(pay.amount) as any,
        currency: pay.currency,
        txHash: null,
        note: {} as any,
      });

      // إشعارات الطرفين
      const buyer = await db.query.users.findFirst({ where: eq(users.id, pay.buyerId) });
      const seller = await db.query.users.findFirst({ where: eq(users.id, pay.sellerId) });

      const msg = `💸 <b>Payment confirmed</b>\nAmount: ${pay.amount} ${pay.currency}`;
      if (buyer?.telegramId) {
        await tgSendMessage(buyer.telegramId, msg, webAppUrl
          ? { inline_keyboard: [[{ text: "Open Marketplace", web_app: { url: webAppUrl } }]] }
          : undefined
        );
      }
      if (seller?.telegramId) {
        await tgSendMessage(seller.telegramId, msg, webAppUrl
          ? { inline_keyboard: [[{ text: "Open Marketplace", web_app: { url: webAppUrl } }]] }
          : undefined
        );
      }

      return res.json(up);
    } catch (e: any) {
      console.error("PATCH /api/payments/:id/confirm error:", e);
      return res.status(500).json({ error: e?.message || "unknown_error" });
    }
  });
}