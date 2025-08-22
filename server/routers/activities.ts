// server/routers/activities.ts
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertActivitySchema } from "@shared/schema";
import { ensureBuyerHasFunds } from "../ton-utils";

/* ========= Telegram notify helper ========= */
async function sendTelegramMessage(
  telegramId: string | null | undefined,
  text: string,
  replyMarkup?: any
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
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

/* ========= helpers ========= */
const listQuery = z.object({
  username: z.string().min(1).optional(),   // ⬅️ بدّلنا من userId إلى username
  listingId: z.string().uuid().optional(),
});

export function mountActivities(app: Express) {
  // List activities by username or listing
  app.get("/api/activities", async (req, res) => {
    try {
      const q = listQuery.safeParse(req.query);
      if (!q.success || (!q.data.username && !q.data.listingId)) {
        return res.status(400).json({ error: "username or listingId required" });
      }

      let rows;
      if (q.data.username) rows = await storage.getActivitiesByUserUsername(q.data.username);
      else rows = await storage.getActivitiesByListing(q.data.listingId!);

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

      // required: listingId + buyerUsername
      const listingId = String(incoming.listingId || "");
      const buyerUsername = String(incoming.buyerUsername || incoming.buyer_username || "").toLowerCase();
      if (!listingId) return res.status(400).json({ error: "listingId required" });
      if (!buyerUsername) return res.status(400).json({ error: "buyerUsername required" });

      // load listing
      const listing = await storage.getChannel(listingId);
      if (!listing || !listing.isActive) {
        return res.status(400).json({ error: "Listing not found or inactive" });
      }

      // seller username from listing (أو من البودي إن أُرسل)
      const sellerUsername =
        String(incoming.sellerUsername || incoming.seller_username || (listing as any).sellerUsername || "").toLowerCase();
      if (!sellerUsername) return res.status(400).json({ error: "sellerUsername required" });

      // fetch users by username لتعبئة الـ IDs (FKs)
      const buyerUser = await storage.getUserByUsername(buyerUsername);
      const sellerUser = await storage.getUserByUsername(sellerUsername);
      if (!buyerUser) return res.status(404).json({ error: "buyer_user_not_found" });
      if (!sellerUser) return res.status(404).json({ error: "seller_user_not_found" });

      // prevent self-purchase
      if (buyerUser.id === sellerUser.id) {
        return res.status(400).json({ error: "Seller cannot buy own listing" });
      }

      // default fields inherited from listing
      if (!incoming.amount) incoming.amount = String(listing.price);
      if (!incoming.currency) incoming.currency = (listing as any).currency ?? "TON";
      if (!incoming.type) incoming.type = "buy";

      // price match (if provided)
      if (incoming.amount != null) {
        const a = parseFloat(String(incoming.amount).replace(",", "."));
        const p = parseFloat(String(listing.price).replace(",", "."));
        if (Number.isFinite(a) && Number.isFinite(p) && a !== p) {
          return res.status(400).json({ error: "Amount does not match listing price" });
        }
      }

      // funds check for buy (TON for now)
      if (incoming.type === "buy") {
        if (!buyerUser.tonWallet) return res.status(400).json({ error: "Buyer wallet not set" });
        const priceTON = parseFloat(String(listing.price).replace(",", "."));
        try {
          await ensureBuyerHasFunds({ userTonAddress: buyerUser.tonWallet, amountTON: priceTON });
        } catch (err: any) {
          if (err?.code === "INSUFFICIENT_FUNDS") {
            return res.status(402).json({ error: err.message, details: err.details });
          }
          return res.status(400).json({ error: err?.message || "Balance check failed" });
        }
      }

      // validate payload (نغذيها بالقيم المشتقة IDs + usernames)
      const activityData = insertActivitySchema.parse({
        ...incoming,
        listingId,
        buyerId: buyerUser.id,
        sellerId: sellerUser.id,
        buyerUsername,
        sellerUsername,
      });

      // create
      const activity = await storage.createActivity(activityData);

      // deactivate non-service listing once bought
      let listingUpdated: any = null;
      if (activity.type === "buy" && (listing.kind || "") !== "service" && listing.isActive) {
        listingUpdated = await storage.updateChannel(listing.id, { isActive: false });
      }

      // notifications
      const humanTitle =
        listing.title ||
        (listing.username ? `@${listing.username}` : `${listing.platform || ""} ${listing.kind || ""}`.trim());
      const priceStr = String(activity.amount ?? listing.price);
      const ccy = String(activity.currency ?? (listing as any).currency ?? "TON");

      if (buyerUser.telegramId) {
        await sendTelegramMessage(
          buyerUser.telegramId,
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
      if (sellerUser.telegramId) {
        await sendTelegramMessage(
          sellerUser.telegramId,
          [
            `📩 <b>New Order Received</b>`,
            ``,
            `<b>Item:</b> ${humanTitle}`,
            `<b>Price:</b> ${priceStr} ${ccy}`,
            buyerUser.username ? `<b>Buyer:</b> @${buyerUser.username}` : "",
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

  // Buyer confirms receipt (usernames فقط)
  app.post("/api/activities/confirm/buyer", async (req, res) => {
    try {
      const listingId = String(req.body?.listingId || "");
      const buyerUsername = String(req.body?.buyerUsername || req.body?.buyer_username || "").toLowerCase();
      const sellerUsername = String(req.body?.sellerUsername || req.body?.seller_username || "").toLowerCase();
      const paymentId = req.body?.paymentId ? String(req.body.paymentId) : null;

      if (!listingId || !buyerUsername || !sellerUsername) {
        return res.status(400).json({ error: "listingId, buyerUsername, sellerUsername are required" });
      }

      const listing = await storage.getChannel(listingId);
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const buyer = await storage.getUserByUsername(buyerUsername);
      const seller = await storage.getUserByUsername(sellerUsername);
      if (!buyer || !seller) return res.status(404).json({ error: "user_not_found" });

      const act = await storage.createActivity({
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
        paymentId,
        buyerUsername,
        sellerUsername,
        type: "buyer_confirm",
        status: "completed",
        amount: String(listing.price),
        currency: (listing as any).currency ?? "TON",
        note: "buyer_confirm",
        txHash: null,
      });

      const title =
        listing.title ||
        (listing.username ? `@${listing.username}` : `${listing.platform || ""} ${listing.kind || ""}`.trim());
      const priceStr = String(listing.price);
      const ccy = String((listing as any).currency ?? "TON");

      if (seller.telegramId) {
        await sendTelegramMessage(
          seller.telegramId,
          [
            `✅ <b>Buyer Confirmed Receipt</b>`,
            ``,
            `<b>Item:</b> ${title}`,
            `<b>Price:</b> ${priceStr} ${ccy}`,
            buyer.username ? `<b>Buyer:</b> @${buyer.username}` : "",
            ``,
            `Admin will review and finalize the transaction.`,
          ].filter(Boolean).join("\n")
        );
      }
      if (buyer.telegramId) {
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

  // Seller confirms delivery (usernames فقط)
  app.post("/api/activities/confirm/seller", async (req, res) => {
    try {
      const listingId = String(req.body?.listingId || "");
      const buyerUsername = String(req.body?.buyerUsername || req.body?.buyer_username || "").toLowerCase();
      const sellerUsername = String(req.body?.sellerUsername || req.body?.seller_username || "").toLowerCase();
      const paymentId = req.body?.paymentId ? String(req.body.paymentId) : null;

      if (!listingId || !buyerUsername || !sellerUsername) {
        return res.status(400).json({ error: "listingId, buyerUsername, sellerUsername are required" });
      }

      const listing = await storage.getChannel(listingId);
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const buyer = await storage.getUserByUsername(buyerUsername);
      const seller = await storage.getUserByUsername(sellerUsername);
      if (!buyer || !seller) return res.status(404).json({ error: "user_not_found" });

      const act = await storage.createActivity({
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
        paymentId,
        buyerUsername,
        sellerUsername,
        type: "seller_confirm",
        status: "completed",
        amount: String(listing.price),
        currency: (listing as any).currency ?? "TON",
        note: "seller_confirm",
        txHash: null,
      });

      const title =
        listing.title ||
        (listing.username ? `@${listing.username}` : `${listing.platform || ""} ${listing.kind || ""}`.trim());
      const priceStr = String(listing.price);
      const ccy = String((listing as any).currency ?? "TON");

      if (buyer.telegramId) {
        await sendTelegramMessage(
          buyer.telegramId,
          [
            `📦 <b>Seller Confirmed Delivery</b>`,
            ``,
            `<b>Item:</b> ${title}`,
            `<b>Price:</b> ${priceStr} ${ccy}`,
            seller.username ? `<b>Seller:</b> @${seller.username}` : "",
            ``,
            `Please confirm receipt from your side if all is OK.`,
          ].filter(Boolean).join("\n")
        );
      }
      if (seller.telegramId) {
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