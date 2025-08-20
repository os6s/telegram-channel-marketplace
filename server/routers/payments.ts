// server/routers/payments.ts
import type { Express } from "express";
import { storage } from "../storage";
import { insertPaymentSchema } from "@shared/schema";
import { tgSendMessage, notifyAdmin } from "../utils/telegram";
import { verifyTonPayment } from "../ton-verify";
import { tgAuth } from "../middleware/tgAuth";

function num(v: any) {
  return Number(String(v).replace(",", "."));
}
function feeCalc(amount: number, feePercent: number) {
  const fee = +(amount * feePercent / 100).toFixed(9);
  const sellerAmount = +(amount - fee).toFixed(9);
  return { fee, sellerAmount };
}

export function mountPayments(app: Express) {
  // إنشاء Payment معلّق + Activity: buy(pending) + إشعار للبائع
  app.post("/api/payments", tgAuth, async (req, res) => {
    try {
      const escrowAddress = process.env.ESCROW_WALLET || "ESCROW_PLACEHOLDER";
      const feePercent = Number(process.env.FEE_PERCENT || "5");

      // المشتري من Telegram initData
      const tgUser = (req as any).telegramUser as { id: number; first_name?: string; username?: string };
      let buyer = await storage.getUserByTelegramId(String(tgUser.id));
      if (!buyer) {
        buyer = await storage.createUser({
          telegramId: String(tgUser.id),
          name: tgUser.first_name || tgUser.username || "tg-user",
        } as any);
      }

      // تحقق من الإعلان والسعر
      const listingId = req.body?.listingId;
      const listing = await storage.getChannel(listingId);
      if (!listing || !listing.isActive) {
        return res.status(400).json({ error: "Listing not found or inactive" });
      }
      const expected = num(listing.price);
      if (num(req.body?.amount) !== expected) {
        return res.status(400).json({ error: "Amount does not match listing price" });
      }

      // بناء الداتا والتحقق بالـ schema بعد تثبيت buyerId
      const draft = insertPaymentSchema.parse({
        ...req.body,
        buyerId: buyer.id,
        escrowAddress,
        feePercent: String(feePercent),
      });

      const { fee, sellerAmount } = feeCalc(expected, feePercent);

      const payment = await storage.createPayment({
        ...draft,
        feeAmount: String(fee),
        sellerAmount: String(sellerAmount),
        status: "pending" as any,
      } as any);

      await storage.createActivity({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: listing.sellerId,
        paymentId: payment.id,
        type: "buy",
        status: "pending",
        amount: String(expected),
        currency: payment.currency as any,
        note: draft.comment ?? null,
      });

      // إشعار للبائع
      const seller = await storage.getUser(listing.sellerId);
      if (seller?.telegramId) {
        const text =
          `🛒 <b>Order opened</b>\n` +
          `Listing: ${listing.title || listing.username || listing.id}\n` +
          `Amount: ${expected} ${payment.currency}\n` +
          `Please follow up in the app.`;
        await tgSendMessage(seller.telegramId, text, {
          inline_keyboard: [[{ text: "Open Marketplace", web_app: { url: process.env.WEBAPP_URL || "" } }]],
        });
      } else {
        await notifyAdmin(`Seller has no telegramId. listingId=${listing.id}`);
      }

      res.status(201).json(payment);
    } catch (e: any) {
      console.error("❌ /api/payments error:", e?.message || e);
      res.status(400).json({ error: e?.message || "Invalid payload" });
    }
  });

  // تأكيد الدفع: تحقّق on-chain قبل set paid
  app.patch("/api/payments/:id/confirm", tgAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const { txHash } = req.body as { txHash?: string };

      const payment = await storage.getPayment(id);
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      if (payment.status !== "pending") return res.status(400).json({ error: "Payment not pending" });

      const listing = await storage.getChannel(payment.listingId);
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const escrow = payment.escrowAddress || process.env.ESCROW_WALLET || "";
      const expectedAmount = num(payment.amount);

      const ok = await verifyTonPayment({
        escrow,
        expected: expectedAmount,
        txHash,
        currency: payment.currency as any,
      });
      if (!ok) return res.status(400).json({ error: "tx_not_verified" });

      const updated = await storage.updatePayment(id, {
        txHash: txHash || payment.txHash || null,
        status: "paid" as any,
        confirmedAt: new Date() as any,
      });
      if (!updated) return res.status(500).json({ error: "Failed to update payment" });

      await storage.createActivity({
        listingId: payment.listingId,
        buyerId: payment.buyerId,
        sellerId: listing.sellerId,
        paymentId: payment.id,
        type: "confirm",
        status: "completed",
        amount: String(payment.amount),
        currency: payment.currency as any,
        txHash: updated.txHash ?? null,
      });

      const buyer = await storage.getUser(payment.buyerId);
      const seller = await storage.getUser(listing.sellerId);
      const msg = `✅ <b>Payment confirmed</b>\nAmount: ${payment.amount} ${payment.currency}`;
      if (buyer?.telegramId) await tgSendMessage(buyer.telegramId, msg);
      if (seller?.telegramId) await tgSendMessage(seller.telegramId, msg);

      res.json(updated);
    } catch (e: any) {
      console.error("❌ /api/payments/:id/confirm error:", e?.message || e);
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });
}