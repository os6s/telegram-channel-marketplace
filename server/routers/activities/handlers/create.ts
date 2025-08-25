import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../../db.js";
import { activities, listings } from "@shared/schema";
import { ensureBuyerHasFunds } from "../../../ton-utils";
import { 
  S, 
  toNum, 
  getListingOrNull, 
  getUserByUsernameInsensitive, 
  sendTelegramMessage 
} from "./_utils.js";
import { addMarketActivity } from "./addMarketActivity.js";  // ✅

export async function createActivity(req: Request, res: Response) {
  try {
    const body = createActivitySchema.parse(req.body || {});
    console.log("createActivity body:", body);

    const listing = await getListingOrNull(body.listingId);
    if (!listing || !listing.isActive) {
      console.warn("Listing not found or inactive:", body.listingId);
      return res.status(400).json({ error: "Listing not found or inactive" });
    }

    const buyer = body.buyerUsername ? await getUserByUsernameInsensitive(body.buyerUsername) : null;
    const seller = await getUserByUsernameInsensitive(body.sellerUsername);

    if (!seller) return res.status(404).json({ error: "seller_user_not_found" });
    if (body.type === "buy" && !buyer) return res.status(404).json({ error: "buyer_user_not_found" });
    if (buyer && buyer.id === seller.id) return res.status(400).json({ error: "seller_cannot_buy_own_listing" });

    console.log("Buyer:", buyer?.id, buyer?.username, "Seller:", seller.id, seller.username);

    const amount = S(body.amount || listing.price);
    const currency = S(body.currency || listing.currency || "TON");

    // تطابق السعر
    const a = toNum(amount);
    const p = toNum(listing.price);
    if (a != null && p != null && a !== p) {
      return res.status(400).json({ error: "amount_mismatch_with_listing_price" });
    }

    // تحقق الرصيد
    if (body.type === "buy" && buyer) {
      if (!buyer.walletAddress) return res.status(400).json({ error: "buyer_wallet_not_set" });
      const priceTON = toNum(listing.price) || 0;
      try {
        await ensureBuyerHasFunds({ userTonAddress: buyer.walletAddress, amountTON: priceTON });
      } catch (err: any) {
        console.error("ensureBuyerHasFunds failed:", err);
        if (err?.code === "INSUFFICIENT_FUNDS") {
          return res.status(402).json({ error: err.message, details: err.details });
        }
        return res.status(400).json({ error: err?.message || "balance_check_failed" });
      }
    }

    // إدخال النشاط العادي
    const [created] = await db
      .insert(activities)
      .values({
        listingId: listing.id,
        buyerId: buyer?.id || null,
        sellerId: seller.id,
        paymentId: body.paymentId,
        type: body.type,
        status: body.type === "buy" ? "processing" : "pending",
        amount,
        currency,
        txHash: body.txHash,
        note: body.note as any,
      })
      .returning();

    console.log("Activity created:", created);

    // تحديث حالة الإعلان إذا شراء
    if (body.type === "buy" && listing.kind !== "service" && listing.isActive) {
      await db.update(listings).set({ isActive: false, updatedAt: new Date() }).where(eq(listings.id, listing.id));
      console.log("Listing marked inactive:", listing.id);
    }

    // ✨ تسجيل داخل الـ market_activity العام
    if (body.type === "buy") {
      await addMarketActivity({
        listingId: listing.id,
        kind: "sold",
        sellerId: seller.id,
        buyerId: buyer?.id || null,
        amount,
        currency,
      });
    } else if (body.type === "list") {
      await addMarketActivity({
        listingId: listing.id,
        kind: "list",
        sellerId: seller.id,
        amount,
        currency,
      });
    }

    // إشعارات التلكرام (بس للشراء)
    if (body.type === "buy" && buyer) {
      const title = listing.title || (listing.username ? `@${listing.username}` : `${listing.platform} ${listing.kind}`);
      const priceStr = S(created.amount || listing.price);
      const ccy = S(created.currency || listing.currency || "TON");

      if (buyer.telegramId) {
        await sendTelegramMessage(
          buyer.telegramId,
          [
            `🛒 <b>Purchase Started</b>`,
            ``,
            `<b>Item:</b> ${title}`,
            `<b>Price:</b> ${priceStr} ${ccy}`,
            ``,
            `✅ Order placed. Please await seller instructions.`
          ].join("\n")
        );
      }

      if (seller.telegramId) {
        await sendTelegramMessage(
          seller.telegramId,
          [
            `📩 <b>New Order Received</b>`,
            ``,
            `<b>Item:</b> ${title}`,
            `<b>Price:</b> ${priceStr} ${ccy}`,
            buyer.username ? `<b>Buyer:</b> @${buyer.username}` : "",
            ``,
            `Please proceed with delivery and communicate in-app if needed.`
          ].filter(Boolean).join("\n")
        );
      }
    }

    res.status(201).json(created);
  } catch (error: any) {
    console.error("createActivity error:", error);
    if (!res.headersSent) {
      res.status(400).json({ error: error?.message || "Invalid payload" });
    }
  }
}