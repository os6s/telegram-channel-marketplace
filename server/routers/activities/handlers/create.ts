import type { Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../../db.js";
import { activities, listings } from "@shared/schema";
import { ensureBuyerHasFunds } from "../../../ton-utils";
import { S, toNum, getListingOrNull, getUserByUsernameInsensitive, sendTelegramMessage } from "./_utils.js";

const createActivitySchema = z.object({
  listingId: z.string().uuid(),
  buyerUsername: z.string().min(1),
  sellerUsername: z.string().min(1),
  type: z.enum(["list","update","buy","buyer_confirm","admin_release","admin_refund","other"]).optional().default("buy"),
  amount: z.string().optional(),
  currency: z.string().optional(),
  paymentId: z.string().uuid().optional(),
  txHash: z.string().optional(),
  note: z.any().optional(),
});

export async function createActivity(req: Request, res: Response) {
  try {
    const body = createActivitySchema.parse(req.body || {});
    const listing = await getListingOrNull(body.listingId);
    if (!listing || !listing.isActive) {
      return res.status(400).json({ error: "Listing not found or inactive" });
    }

    const buyer = await getUserByUsernameInsensitive(body.buyerUsername);
    const seller = await getUserByUsernameInsensitive(body.sellerUsername);
    if (!buyer) return res.status(404).json({ error: "buyer_user_not_found" });
    if (!seller) return res.status(404).json({ error: "seller_user_not_found" });
    if (buyer.id === seller.id) return res.status(400).json({ error: "seller_cannot_buy_own_listing" });

    const amount = S(body.amount || listing.price);
    const currency = S(body.currency || listing.currency || "TON");

    const a = toNum(amount);
    const p = toNum(listing.price);
    if (a != null && p != null && a !== p) {
      return res.status(400).json({ error: "amount_mismatch_with_listing_price" });
    }

    if (body.type === "buy") {
      if (!buyer.walletAddress) return res.status(400).json({ error: "buyer_wallet_not_set" });
      const priceTON = toNum(listing.price) || 0;
      try {
        await ensureBuyerHasFunds({ userTonAddress: buyer.walletAddress, amountTON: priceTON });
      } catch (err: any) {
        if (err?.code === "INSUFFICIENT_FUNDS") {
          return res.status(402).json({ error: err.message, details: err.details });
        }
        return res.status(400).json({ error: err?.message || "balance_check_failed" });
      }
    }

    const [created] = await db
      .insert(activities)
      .values({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        paymentId: body.paymentId,
        type: body.type,
        status: "pending",
        amount,
        currency,
        txHash: body.txHash,
        note: body.note as any,
      })
      .returning();

    if (body.type === "buy" && listing.kind !== "service" && listing.isActive) {
      await db.update(listings).set({ isActive: false, updatedAt: new Date() }).where(eq(listings.id, listing.id));
    }

    const title = listing.title || (listing.username ? `@${listing.username}` : `${listing.platform} ${listing.kind}`);
    const priceStr = S(created.amount || listing.price);
    const ccy = S(created.currency || listing.currency || "TON");

    await sendTelegramMessage(
      buyer.telegramId,
      [`🛒 <b>Purchase Started</b>`, ``, `<b>Item:</b> ${title}`, `<b>Price:</b> ${priceStr} ${ccy}`, ``, `✅ Order placed. Please await seller instructions.`].join("\n")
    );
    await sendTelegramMessage(
      seller.telegramId,
      [`📩 <b>New Order Received</b>`, ``, `<b>Item:</b> ${title}`, `<b>Price:</b> ${priceStr} ${ccy}`, buyer.username ? `<b>Buyer:</b> @${buyer.username}` : "", ``, `Please proceed with delivery and communicate in-app if needed.`].filter(Boolean).join("\n")
    );

    res.status(201).json(created);
  } catch (error: any) {
    if (!res.headersSent) res.status(400).json({ error: error?.message || "Invalid payload" });
  }
}
