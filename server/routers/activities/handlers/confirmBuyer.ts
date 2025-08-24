import type { Request, Response } from "express";
import { z } from "zod";
import { db } from "../../../db.js";
import { activities } from "@shared/schema";
import { S, getListingOrNull, getUserByUsernameInsensitive, sendTelegramMessage } from "./_utils.js";

const confirmSchema = z.object({
  listingId: z.string().uuid(),
  buyerUsername: z.string().min(1),
  sellerUsername: z.string().min(1),
  paymentId: z.string().uuid().optional(),
});

export async function confirmBuyer(req: Request, res: Response) {
  try {
    const body = confirmSchema.parse({
      listingId: req.body?.listingId,
      buyerUsername: req.body?.buyerUsername || req.body?.buyer_username,
      sellerUsername: req.body?.sellerUsername || req.body?.seller_username,
      paymentId: req.body?.paymentId,
    });

    const listing = await getListingOrNull(body.listingId);
    if (!listing) return res.status(404).json({ error: "listing_not_found" });

    const buyer = await getUserByUsernameInsensitive(body.buyerUsername);
    const seller = await getUserByUsernameInsensitive(body.sellerUsername);
    if (!buyer || !seller) return res.status(404).json({ error: "user_not_found" });

    const [row] = await db
      .insert(activities)
      .values({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        paymentId: body.paymentId,
        type: "buyer_confirm",
        status: "completed",
        amount: S(listing.price),
        currency: S(listing.currency || "TON"),
        note: { tag: "buyer_confirm" } as any,
      })
      .returning();

    const title = listing.title || (listing.username ? `@${listing.username}` : `${listing.platform} ${listing.kind}`);
    const priceStr = S(listing.price);
    const ccy = S(listing.currency || "TON");

    await sendTelegramMessage(
      seller.telegramId,
      [`✅ <b>Buyer Confirmed Receipt</b>`, ``, `<b>Item:</b> ${title}`, `<b>Price:</b> ${priceStr} ${ccy}`, buyer.username ? `<b>Buyer:</b> @${buyer.username}` : "", ``, `Admin will review and finalize the transaction.`].filter(Boolean).join("\n")
    );
    await sendTelegramMessage(
      buyer.telegramId,
      [`📝 <b>Your confirmation was recorded</b>`, ``, `<b>Item:</b> ${title}`, `<b>Status:</b> Waiting for admin finalization`].join("\n")
    );

    res.status(201).json(row);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Failed to confirm (buyer)" });
  }
}
