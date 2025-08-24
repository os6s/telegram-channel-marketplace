// server/routers/activities.ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db.js";
import { activities, listings, users } from "@shared/schema";
import { insertActivitySchema } from "@shared/dto";
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
    await res.json().catch(() => null);
  } catch {}
}

/* ========= helpers ========= */
const listQuery = z.object({
  username: z.string().min(1).optional(),
  listingId: z.string().uuid().optional(),
});

const S = (v: unknown) => (v == null ? "" : String(v));

async function getUserByUsernameInsensitive(username: string) {
  const u = await db.query.users.findFirst({
    where: sql`lower(${users.username}) = ${username.toLowerCase()}`,
  });
  return u || null;
}

async function getListingOr404(id: string) {
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
  // استخدم alias بدل users.as
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
          buyerUsername: users.username,
          sellerUsername: sellerU.username,
          title: listings.title,
          handle: listings.username,
        })
        .from(activities)
        .leftJoin(users, eq(users.id, activities.buyerId))
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
          buyerUsername: users.username,
          sellerUsername: sellerU.username,
          title: listings.title,
          handle: listings.username,
        })
        .from(activities)
        .leftJoin(users, eq(users.id, activities.buyerId))
        .leftJoin(sellerU, eq(sellerU.id, activities.sellerId))
        .leftJoin(listings, eq(listings.id, activities.listingId))
        .where(eq(activities.id, id));

      if (!row.length) return res.status(404).json({ error: "Activity not found" });
      res.json(row[0]);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  // باقي الراوترات (create / confirm / update) بدون تغيير
  // ...
}