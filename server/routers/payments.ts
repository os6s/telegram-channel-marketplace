// server/routers/payments.ts
import type { Express } from "express";
import { storage } from "../storage";
import { insertPaymentSchema, type Payment } from "@shared/schema";
import { tgSendMessage, notifyAdmin } from "../utils/telegram";
import { tgAuth } from "../middleware/tgAuth";

type TgUser = { id: number; first_name?: string; username?: string };

function num(v: unknown): number {
  return Number(String(v).replace(",", "."));
}
function feeCalc(amount: number, feePercent: number) {
  const fee = +((amount * feePercent) / 100).toFixed(9);
  const sellerAmount = +(amount - fee).toFixed(9);
  return { fee, sellerAmount };
}
function sum(rows: Payment[], pred: (p: Payment) => boolean) {
  return +rows.filter(pred).reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(9);
}

export function mountPayments(app: Express) {
  // إنشاء طلب شراء من الرصيد: يحجز من الرصيد ويمنع التكرار
  app.post("/api/payments", tgAuth, async (req, res) => {
    try {
      const escrowAddress = (process.env.ESCROW_WALLET || "").trim();
      if (!escrowAddress) return res.status(500).json({ error: "ESCROW_WALLET not set" });
      const feePercent = Number(process.env.FEE_PERCENT || "5");

      // المشتري من تيليجرام
      const tgUser = (req as unknown as { telegramUser: TgUser }).telegramUser;
      let buyer = await storage.getUserByTelegramId(String(tgUser.id));
      if (!buyer) {
        buyer = await storage.createUser({
          telegramId: String(tgUser.id),
          username: tgUser.username ?? null,
          firstName: tgUser.first_name ?? null,
          lastName: null,
          tonWallet: null,
          walletAddress: null,
          role: "user",
        });
      }
      if (!buyer.username) {
        return res.status(400).json({ error: "buyer_username_required" });
      }
      const buyerUsername = buyer.username.toLowerCase();

      // الإعلان
      const listingId = String(req.body?.listingId || "");
      const listing = await storage.getChannel(listingId);
      if (!listing || !listing.isActive) {
        return res.status(400).json({ error: "Listing not found or inactive" });
      }

      // ضروري نعرف البائع باليوزرنيم من الإعلان
      const sellerUsername = (listing as any).sellerUsername as string | null | undefined;
      if (!sellerUsername) {
        return res.status(400).json({ error: "seller_username_required" });
      }
      // حاول نجلب user للبائع حتى نقدر نكتب activity (FKs)
      const sellerUser = await storage.getUserByUsername(sellerUsername);
      if (!sellerUser) {
        return res.status(400).json({ error: "seller_user_not_found" });
      }

      const expected = num(listing.price);

      // رصيد المشتري المتاح = إيداعات مدفوعة - طلبات محجوزة (pending/paid)
      const pays = await storage.listPaymentsByBuyerUsername(buyerUsername);
      const deposits = sum(pays, (p) => p.kind === "deposit" && p.status === "paid");
      const locked = sum(
        pays,
        (p) => p.kind === "order" && p.locked && (p.status === "pending" || p.status === "paid"),
      );
      const balance = +(deposits - locked).toFixed(9);
      if (balance < expected) {
        return res.status(402).json({ error: "insufficient_balance", balance, required: expected });
      }

      // منع تكرار: إن وجد pending لنفس الإعلان والمشتري رجّعه
      const dup = pays.find((p) => p.kind === "order" && p.listingId === listing.id && p.status === "pending");
      if (dup) return res.status(200).json(dup);

      const { fee, sellerAmount } = feeCalc(expected, feePercent);

      // نكتب السجل مع buyerUsername/sellerUsername
      const draft = insertPaymentSchema.parse({
        listingId: listing.id,
        buyerId: buyer.id,                 // موجود بالسكيمة/الـDB
        buyerUsername: buyerUsername,      // جديد: نعبيه
        sellerUsername: sellerUsername.toLowerCase(),
        kind: "order",
        locked: true,
        amount: String(expected),
        currency: "TON",
        feePercent: String(feePercent),
        feeAmount: String(fee),
        sellerAmount: String(sellerAmount),
        escrowAddress,
        comment: req.body?.comment ?? null,
        txHash: null,
        buyerConfirmed: false,
        sellerConfirmed: false,
        status: "pending",
        adminAction: "none",
      });

      const payment = await storage.createPayment(draft);

      // نشاط "buy" مع حالة pending — نحط IDs + usernames
      await storage.createActivity({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: sellerUser.id,
        paymentId: payment.id,
        buyerUsername: buyerUsername,
        sellerUsername: sellerUsername.toLowerCase(),
        type: "buy",
        status: "pending",
        amount: String(expected),
        currency: payment.currency,
        txHash: null,
        note: draft.comment ?? null,
      });

      // إخطار البائع
      if (sellerUser.telegramId) {
        const text =
          `🛒 <b>Order opened</b>\n` +
          `Listing: ${listing.title || listing.username || listing.id}\n` +
          `Amount: ${expected} ${payment.currency}\n` +
          `Please follow up in the app.`;
        await tgSendMessage(sellerUser.telegramId, text, {
          inline_keyboard: [[{ text: "Open Marketplace", web_app: { url: process.env.WEBAPP_URL || "" } }]],
        });
      } else {
        await notifyAdmin(`Seller has no telegramId. listingId=${listing.id}, seller=@${sellerUsername}`);
      }

      res.status(201).json(payment);
    } catch (e) {
      console.error("❌ /api/payments error:", e);
      res.status(400).json({ error: "Invalid payload" });
    }
  });

  // تأكيد الطلب: يثبت الدفع داخليًا من الرصيد
  app.patch("/api/payments/:id/confirm", tgAuth, async (req, res) => {
    try {
      const id = req.params.id;

      const payment = await storage.getPayment(id);
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      if (payment.kind !== "order") return res.status(400).json({ error: "Not an order payment" });
      if (payment.status !== "pending") return res.status(400).json({ error: "Payment not pending" });

      const listingId = payment.listingId;
      if (!listingId) return res.status(400).json({ error: "Missing listingId" });

      const listing = await storage.getChannel(listingId);
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const up = await storage.updatePayment(id, {
        status: "paid",
        confirmedAt: new Date(),
      });
      if (!up) return res.status(500).json({ error: "Failed to update payment" });

      // نحتاج sellerId من الـ username
      const sellerUsername = (payment.sellerUsername ||
        (listing as any).sellerUsername ||
        "").toString();
      const sellerUser = sellerUsername
        ? await storage.getUserByUsername(sellerUsername)
        : undefined;
      if (!sellerUser) {
        return res.status(400).json({ error: "seller_user_not_found" });
      }

      // نشاط "buyer_confirm"
      await storage.createActivity({
        listingId,
        buyerId: payment.buyerId,
        sellerId: sellerUser.id,
        paymentId: payment.id,
        buyerUsername: (payment.buyerUsername || "").toString() || undefined,
        sellerUsername: sellerUsername || undefined,
        type: "buyer_confirm",
        status: "completed",
        amount: String(payment.amount),
        currency: payment.currency,
        txHash: null,
        note: null,
      });

      // إشعارات
      const buyer = await storage.getUser(payment.buyerId);
      const msg = `✅ <b>Payment confirmed</b>\nAmount: ${payment.amount} ${payment.currency}`;
      if (buyer?.telegramId) await tgSendMessage(buyer.telegramId, msg);
      if (sellerUser?.telegramId) await tgSendMessage(sellerUser.telegramId, msg);

      res.json(up);
    } catch (e) {
      console.error("❌ /api/payments/:id/confirm error:", e);
      res.status(500).json({ error: "Unknown error" });
    }
  });
}