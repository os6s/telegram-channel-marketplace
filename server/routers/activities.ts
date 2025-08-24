// server/routers/activities.ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { desc, eq, or, sql, alias } from "drizzle-orm";
import { db } from "../db.js";
import { activities, listings, users } from "@shared/schema";
import { ensureBuyerHasFunds } from "../ton-utils";

/* ========= Telegram notify helper ========= */
async function sendTelegramMessage(
  telegramId: string | number | null | undefined,
  text: string,
  replyMarkup?: any
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const chatId = Number(telegramId);
  if (!Number.isFinite(chatId)) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
  } catch { /* ignore */ }
}

/* ========= schemas (محلية) ========= */
const listQuery = z.object({
  username: z.string().min(1).optional(),
  listingId: z.string().uuid().optional(),
});

const createActivitySchema = z.object({
  listingId: z.string().uuid(),
  buyerUsername: z.string().min(1),
  sellerUsername: z.string().min(1),
  type: z
    .enum(["list", "update", "buy", "buyer_confirm", "admin_release", "admin_refund", "other"])
    .optional()
    .default("buy"),
  amount: z.string().optional(),
  currency: z.string().optional(),
  paymentId: z.string().uuid().optional(),
  txHash: z.string().optional(),
  note: z.any().optional(),
});

const confirmSchema = z.object({
  listingId: z.string().uuid(),
  buyerUsername: z.string().min(1),
  sellerUsername: z.string().min(1),
  paymentId: z.string().uuid().optional(),
});

/* ========= helpers ========= */
const S = (v: unknown) => (v == null ? "" : String(v));

async function getUserByUsernameInsensitive(username: string) {
  const u = await db.query.users.findFirst({
    where: sql`lower(${users.username}) = ${username.toLowerCase()}`,
  });
  return u || null;
}

async function getListingOrNull(id: string) {
  const l = await db.query.listings.findFirst({ where: eq(listings.id, id) });
  return l || null;
}

function toNum(v: unknown): number | null {
  if (v == null || S(v).trim() === "") return null;
  const n = Number(S(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* ========= Router ========= */
export function mountActivities(app: Express) {
  const buyerU = alias(users, "buyer_u");
  const sellerU = alias(users, "seller_u");

  // List activities by username or listing
  app.get("/api/activities", async (req: Request, res: Response) => {
    try {
      const q = listQuery.safeParse(req.query);
      if (!q.success || (!q.data.username && !q.data.listingId)) {
        return res.status(400).json({ error: "username or listingId required" });
      }

      let whereExp;
      if (q.data.username) {
        const u = await getUserByUsernameInsensitive(q.data.username);
        if (!u) return res.json([]);
        whereExp = or(eq(activities.buyerId, u.id), eq(activities.sellerId, u.id));
      } else {
        whereExp = eq(activities.listingId, q.data.listingId!);
      }

      const rows = await db
        .select({
          id: activities.id,
          listingId: activities.listingId,
          buyerId: activities.buyerId,
          sellerId: activities.sellerId,
          paymentId: activities.paymentId,
          type: activities.type,
          status: activities.status,
          amount: activities.amount,
          currency: activities.currency,
          txHash: activities.txHash,
          note: activities.note,
          createdAt: activities.createdAt,
          buyerUsername: buyerU.username,
          sellerUsername: sellerU.username,
          title: listings.title,
          handle: listings.username,
        })
        .from(activities)
        .leftJoin(buyerU, eq(buyerU.id, activities.buyerId))
        .leftJoin(sellerU, eq(sellerU.id, activities.sellerId))
        .leftJoin(listings, eq(listings.id, activities.listingId))
        .where(whereExp)
        .orderBy(desc(activities.createdAt));

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  // Get activity by id
  app.get("/api/activities/:id", async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || "");
      if (!id) return res.status(400).json({ error: "id required" });

      const row = await db
        .select({
          id: activities.id,
          listingId: activities.listingId,
          buyerId: activities.buyerId,
          sellerId: activities.sellerId,
          paymentId: activities.paymentId,
          type: activities.type,
          status: activities.status,
          amount: activities.amount,
          currency: activities.currency,
          txHash: activities.txHash,
          note: activities.note,
          createdAt: activities.createdAt,
          buyerUsername: buyerU.username,
          sellerUsername: sellerU.username,
          title: listings.title,
          handle: listings.username,
        })
        .from(activities)
        .leftJoin(buyerU, eq(buyerU.id, activities.buyerId))
        .leftJoin(sellerU, eq(sellerU.id, activities.sellerId))
        .leftJoin(listings, eq(listings.id, activities.listingId))
        .where(eq(activities.id, id));

      if (!row.length) return res.status(404).json({ error: "Activity not found" });
      res.json(row[0]);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  // Create activity (buy / …)
  app.post("/api/activities", async (req: Request, res: Response) => {
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

      // funds check for buy (uses walletAddress)
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

      const created = await db
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

      const activity = created[0];

      if (body.type === "buy" && listing.kind !== "service" && listing.isActive) {
        await db
          .update(listings)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(listings.id, listing.id));
      }

      const title = listing.title || (listing.username ? `@${listing.username}` : `${listing.platform} ${listing.kind}`);
      const priceStr = S(activity.amount || listing.price);
      const ccy = S(activity.currency || listing.currency || "TON");

      await sendTelegramMessage(
        buyer.telegramId,
        [
          `🛒 <b>Purchase Started</b>`,
          ``,
          `<b>Item:</b> ${title}`,
          `<b>Price:</b> ${priceStr} ${ccy}`,
          ``,
          `✅ Order placed. Please await seller instructions.`,
        ].join("\n")
      );
      await sendTelegramMessage(
        seller.telegramId,
        [
          `📩 <b>New Order Received</b>`,
          ``,
          `<b>Item:</b> ${title}`,
          `<b>Price:</b> ${priceStr} ${ccy}`,
          buyer.username ? `<b>Buyer:</b> @${buyer.username}` : "",
          ``,
          `Please proceed with delivery and communicate in-app if needed.`,
        ].filter(Boolean).join("\n")
      );

      res.status(201).json(activity);
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(400).json({ error: error?.message || "Invalid payload" });
      }
    }
  });

  // Buyer confirms receipt
  app.post("/api/activities/confirm/buyer", async (req: Request, res: Response) => {
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

      const created = await db
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
      await sendTelegramMessage(
        buyer.telegramId,
        [`📝 <b>Your confirmation was recorded</b>`, ``, `<b>Item:</b> ${title}`, `<b>Status:</b> Waiting for admin finalization`].join("\n")
      );

      res.status(201).json(created[0]);
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Failed to confirm (buyer)" });
    }
  });

  // Seller confirms delivery
  app.post("/api/activities/confirm/seller", async (req: Request, res: Response) => {
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

      const created = await db
        .insert(activities)
        .values({
          listingId: listing.id,
          buyerId: buyer.id,
          sellerId: seller.id,
          paymentId: body.paymentId,
          type: "seller_confirm",
          status: "completed",
          amount: S(listing.price),
          currency: S(listing.currency || "TON"),
          note: { tag: "seller_confirm" } as any,
        })
        .returning();

      const title = listing.title || (listing.username ? `@${listing.username}` : `${listing.platform} ${listing.kind}`);
      const priceStr = S(listing.price);
      const ccy = S(listing.currency || "TON");

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
      await sendTelegramMessage(
        seller.telegramId,
        [`📝 <b>Your delivery confirmation was recorded</b>`, ``, `<b>Item:</b> ${title}`, `<b>Status:</b> Waiting for buyer / admin`].join("\n")
      );

      res.status(201).json(created[0]);
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Failed to confirm (seller)" });
    }
  });

  // Update activity (status / note)
  app.patch("/api/activities/:id", async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || "");
      if (!id) return res.status(400).json({ error: "id required" });

      const allowed: Partial<typeof activities.$inferInsert> = {};
      if (typeof req.body?.status === "string") allowed.status = req.body.status as any;
      if (req.body?.note !== undefined) allowed.note = req.body.note;

      if (Object.keys(allowed).length === 0) {
        return res.status(400).json({ error: "no_updates" });
      }

      const updated = await db.update(activities).set(allowed).where(eq(activities.id, id)).returning();
      if (!updated.length) return res.status(404).json({ error: "Activity not found" });
      res.json(updated[0]);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });
}