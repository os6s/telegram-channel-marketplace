export async function confirmBuyer(req: Request, res: Response) {
  try {
    const body = confirmSchema.parse({
      listingId: req.body?.listingId,
      buyerUsername: req.body?.buyerUsername || req.body?.buyer_username,
      sellerUsername: req.body?.sellerUsername || req.body?.seller_username,
      paymentId: req.body?.paymentId,
    });

    console.log("confirmBuyer body:", body); // 👈 log request body

    const listing = await getListingOrNull(body.listingId);
    if (!listing) {
      console.warn("confirmBuyer listing_not_found:", body.listingId);
      return res.status(404).json({ error: "listing_not_found" });
    }

    const buyer = await getUserByUsernameInsensitive(body.buyerUsername);
    const seller = await getUserByUsernameInsensitive(body.sellerUsername);
    if (!buyer || !seller) {
      console.warn("confirmBuyer user_not_found:", { buyer: body.buyerUsername, seller: body.sellerUsername });
      return res.status(404).json({ error: "user_not_found" });
    }

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

    console.log("confirmBuyer activity inserted:", row); // 👈 log inserted row

    const title = listing.title || (listing.username ? `@${listing.username}` : `${listing.platform} ${listing.kind}`);
    const priceStr = S(listing.price);
    const ccy = S(listing.currency || "TON");

    await sendTelegramMessage(
      seller.telegramId,
      [
        `✅ <b>Buyer Confirmed Receipt</b>`,
        ``,
        `<b>Item:</b> ${title}`,
        `<b>Price:</b> ${priceStr} ${ccy}`,
        buyer.username ? `<b>Buyer:</b> @${buyer.username}` : "",
        ``,
        `Admin will review and finalize the transaction.`
      ].filter(Boolean).join("\n")
    );

    await sendTelegramMessage(
      buyer.telegramId,
      [
        `📝 <b>Your confirmation was recorded</b>`,
        ``,
        `<b>Item:</b> ${title}`,
        `<b>Status:</b> Waiting for admin finalization`
      ].join("\n")
    );

    res.status(201).json(row);
  } catch (e: any) {
    console.error("confirmBuyer error:", e); // 👈 detailed error log
    res.status(400).json({ error: e?.message || "Failed to confirm (buyer)" });
  }
}