// server/routers/activities.ts
import type { Express } from "express";
import { storage } from "../storage";
import { insertActivitySchema } from "@shared/schema";
import { ensureBuyerHasFunds } from "../ton-utils";

/* ========= Telegram notify helper ========= */
async function sendTelegramMessage(
  telegramId: string | null | undefined,
  text: string,
  replyMarkup?: any
) {
  const token = process.env.TELEGRAM_BOT_TOKEN; // يجب ضبطه في Render
  if (!token) {
    console.warn("[notify] TELEGRAM_BOT_TOKEN missing – skipping telegram notify");
    return;
  }
  const chatId = telegramId ? Number(telegramId) : NaN;
  if (!Number.isFinite(chatId)) {
    console.warn("[notify] invalid telegramId, skipping");
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
    const data = await res.json();
    if (!data?.ok) console.warn("[notify] telegram sendMessage failed:", data);
  } catch (e) {
    console.error("[notify] telegram error:", e);
  }
}

/**
 * Endpoints:
 * GET   /api/activities?userId=... | listingId=...
 * GET   /api/activities/:id
 * POST  /api/activities                      { type, listingId, buyerId, [sellerId], [amount], [currency], ... }
 * POST  /api/activities/confirm/buyer        { listingId, buyerId, sellerId, [paymentId] }
 * POST  /api/activities/confirm/seller       { listingId, buyerId, sellerId, [paymentId] }
 * PATCH /api/activities/:id                  partial updates
 */
export function mountActivities(app: Express) {
  // List activities by user or listing
  app.get("/api/activities", async (req, res) => {
    try {
      const userId = (req.query.userId as string) || "";
      const listingId = (req.query.listingId as string) || "";

      let rows;
      if (userId) rows = await storage.getActivitiesByUser(userId);
      else if (listingId) rows = await storage.getActivitiesByChannel(listingId);
      else return res.status(400).json({ error: "userId or listingId required" });

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  // Get activity by id
  app.get("/api/activities/:id", async (req, res) => {
    try {
      const activity = await storage.getActivity(req.params.id);
      if (!activity) return res.status(404).json({ error: "Activity not found" });
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  // Create activity (buy/confirm/cancel/…)
  app.post("/api/activities", async (req, res) => {
    try {
      const incoming = { ...(req.body || {}) };

      // لازم listingId موجود
      if (!incoming.listingId) return res.status(400).json({ error: "listingId required" });

      // جيب الـ listing وتأكد نشط
      const listing = await storage.getChannel(incoming.listingId);
      if (!listing || !listing.isActive) {
        return res.status(400).json({ error: "Listing not found or inactive" });
      }

      // حقول افتراضية من الـ listing
      if (!incoming.sellerId) incoming.sellerId = listing.sellerId;
      if (!incoming.amount)   incoming.amount   = String(listing.price);
      if (!incoming.currency) incoming.currency = (listing as any).currency || "TON";
      if (!incoming.type)     incoming.type     = "buy"; // افتراضيًا إذا ما تحدد النوع

      // تحقق من تطابق السعر إذا أُرسل
      if (incoming.amount != null) {
        const a = parseFloat(String(incoming.amount).replace(",", "."));
        const p = parseFloat(String(listing.price).replace(",", "."));
        if (Number.isFinite(a) && Number.isFinite(p) && a !== p) {
          return res.status(400).json({ error: "Amount does not match listing price" });
        }
      }

      // 🔒 منع الشراء بدون رصيد كافٍ (TON فقط حالياً)
      if (incoming.type === "buy") {
        const buyer = await storage.getUser(incoming.buyerId);
        if (!buyer?.tonWallet) {
          return res.status(400).json({ error: "Buyer wallet not set" });
        }
        const priceTON = parseFloat(String(listing.price).replace(",", "."));
        try {
          await ensureBuyerHasFunds({ userTonAddress: buyer.tonWallet, amountTON: priceTON });
        } catch (err: any) {
          if (err?.code === "INSUFFICIENT_FUNDS") {
            return res.status(402).json({ error: err.message, details: err.details }); // 402 Payment Required
          }
          return res.status(400).json({ error: err?.message || "Balance check failed" });
        }
      }

      // تحقق نهائي عبر الـ schema
      const activityData = insertActivitySchema.parse(incoming);

      // أنشئ الـ Activity (التحقق الإضافي موجود داخل storage.createActivity أيضًا)
      const activity = await storage.createActivity(activityData);

      // إذا كانت عملية شراء "buy" وعلى نوع غير "service" → عطّل الإعلان حتى لا يُشترى مرتين
      let listingUpdated: any = null;
      if (activity.type === "buy" && (listing.kind || "") !== "service") {
        if (listing.isActive) {
          listingUpdated = await storage.updateChannel(listing.id, { isActive: false });
        }
      }

      // إشعار تلغرام للبائع والمشتري
      const buyer = await storage.getUser(activity.buyerId);
      const seller = await storage.getUser(activity.sellerId);

      const humanTitle =
        listing.title ||
        (listing.username ? `@${listing.username}` : `${listing.platform || ""} ${listing.kind || ""}`.trim());

      const priceStr = String(activity.amount ?? listing.price);
      const ccy = String(activity.currency ?? (listing as any).currency ?? "TON");

      // للمشتري
      if (buyer?.telegramId) {
        await sendTelegramMessage(
          buyer.telegramId,
          [
            `🛒 <b>Purchase Started</b>`,
            ``,
            `<b>Item:</b> ${humanTitle}`,
            `<b>Price:</b> ${priceStr} ${ccy}`,
            ``,
            `✅ Your order has been placed. Please await seller instructions.`,
            `If anything goes wrong, you can open a dispute from the order screen.`,
          ].join("\n")
        );
      }

      // للبائع
      if (seller?.telegramId) {
        await sendTelegramMessage(
          seller.telegramId,
          [
            `📩 <b>New Order Received</b>`,
            ``,
            `<b>Item:</b> ${humanTitle}`,
            `<b>Price:</b> ${priceStr} ${ccy}`,
            buyer?.username ? `<b>Buyer:</b> @${buyer.username}` : "",
            ``,
            `Please proceed with delivery and communicate in-app if needed.`,
          ]
            .filter(Boolean)
            .join("\n")
        );
      }

      res.status(201).json({ activity, listingUpdated });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Invalid payload" });
    }
  });

  /* ========= Buyer confirms receipt =========
     Body: { listingId, buyerId, sellerId, [paymentId] }
     Creates an activity(type='confirm', note='buyer_confirm') and NOTIFIES both sides.
     لا يوجد أي إطلاق أموال تلقائي — قرار الأدمن لاحقاً.
  ========================================== */
  app.post("/api/activities/confirm/buyer", async (req, res) => {
    try {
      const { listingId, buyerId, sellerId, paymentId } = req.body || {};
      if (!listingId || !buyerId || !sellerId) {
        return res.status(400).json({ error: "listingId, buyerId, sellerId are required" });
      }
      const listing = await storage.getChannel(String(listingId));
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const act = await storage.createActivity({
        listingId: String(listingId),
        buyerId: String(buyerId),
        sellerId: String(sellerId),
        paymentId: paymentId ? String(paymentId) : null,
        type: "confirm",
        status: "completed",
        amount: String(listing.price),
        currency: (listing as any).currency ?? "TON",
        note: "buyer_confirm",
        txHash: null,
      });

      const buyer = await storage.getUser(String(buyerId));
      const seller = await storage.getUser(String(sellerId));
      const title =
        listing.title ||
        (listing.username ? `@${listing.username}` : `${listing.platform || ""} ${listing.kind || ""}`.trim());
      const priceStr = String(listing.price);
      const ccy = String((listing as any).currency ?? "TON");

      // إشعار
      if (seller?.telegramId) {
        await sendTelegramMessage(
          seller.telegramId,
          [
            `✅ <b>Buyer Confirmed Receipt</b>`,
            ``,
            `<b>Item:</b> ${title}`,
            `<b>Price:</b> ${priceStr} ${ccy}`,
            buyer?.username ? `<b>Buyer:</b> @${buyer.username}` : "",
            ``,
            `Admin will review and finalize the transaction.`,
          ].filter(Boolean).join("\n")
        );
      }
      if (buyer?.telegramId) {
        await sendTelegramMessage(
          buyer.telegramId,
          [
            `📝 <b>Your confirmation was recorded</b>`,
            ``,
            `<b>Item:</b> ${title}`,
            `<b>Status:</b> Waiting for admin finalization`,
          ].join("\n")
        );
      }

      res.status(201).json({ activity: act });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Failed to confirm (buyer)" });
    }
  });

  /* ========= Seller confirms delivery =========
     Body: { listingId, buyerId, sellerId, [paymentId] }
     Creates an activity(type='confirm', note='seller_confirm') and NOTIFIES both sides.
  ============================================ */
  app.post("/api/activities/confirm/seller", async (req, res) => {
    try {
      const { listingId, buyerId, sellerId, paymentId } = req.body || {};
      if (!listingId || !buyerId || !sellerId) {
        return res.status(400).json({ error: "listingId, buyerId, sellerId are required" });
      }
      const listing = await storage.getChannel(String(listingId));
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const act = await storage.createActivity({
        listingId: String(listingId),
        buyerId: String(buyerId),
        sellerId: String(sellerId),
        paymentId: paymentId ? String(paymentId) : null,
        type: "confirm",
        status: "completed",
        amount: String(listing.price),
        currency: (listing as any).currency ?? "TON",
        note: "seller_confirm",
        txHash: null,
      });

      const buyer = await storage.getUser(String(buyerId));
      const seller = await storage.getUser(String(sellerId));
      const title =
        listing.title ||
        (listing.username ? `@${listing.username}` : `${listing.platform || ""} ${listing.kind || ""}`.trim());
      const priceStr = String(listing.price);
      const ccy = String((listing as any).currency ?? "TON");

      // إشعار
      if (buyer?.telegramId) {
        await sendTelegramMessage(
          buyer.telegramId,
          [
            `📦 <b>Seller Confirmed Delivery</b>`,
            ``,
            `<b>Item:</b> ${title}`,
            `<b>Price:</b> ${priceStr} ${ccy}`,
            seller?.username ? `<b>Seller:</b> @${seller.username}` : "",
            ``,
            `Please confirm receipt from your side if all is OK.`,
          ].filter(Boolean).join("\n")
        );
      }
      if (seller?.telegramId) {
        await sendTelegramMessage(
          seller.telegramId,
          [
            `📝 <b>Your delivery confirmation was recorded</b>`,
            ``,
            `<b>Item:</b> ${title}`,
            `<b>Status:</b> Waiting for buyer / admin`,
          ].join("\n")
        );
      }

      res.status(201).json({ activity: act });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Failed to confirm (seller)" });
    }
  });

  // Update activity (generic)
  app.patch("/api/activities/:id", async (req, res) => {
    try {
      const updates = req.body || {};
      const activity = await storage.updateActivity(req.params.id, updates);
      if (!activity) return res.status(404).json({ error: "Activity not found" });
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });
}