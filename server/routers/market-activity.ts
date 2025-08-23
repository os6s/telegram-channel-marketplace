// server/routers/market-activity.ts
import type { Express } from "express";
import { db } from "../db";
import { listings, activities, users } from "@shared/schema";
import { desc, eq, or, and, sql } from "drizzle-orm";

/**
 * GET /api/market-activity
 * Query:
 *   limit?  (default 30)
 *   cursor? (ISO date, يعيد عناصر createdAt < cursor)
 *
 * Response: [{ id, kind: 'listed'|'sold', createdAt, title, username, price, currency, seller, buyer }]
 */
export function mountMarketActivity(app: Express) {
  app.get("/api/market-activity", async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit ?? 30), 1), 100);
      const cursor = req.query.cursor ? new Date(String(req.query.cursor)) : null;

      const chunks: any[] = [];

      // ===== listed =====
      {
        const whereParts: any[] = [];
        if (cursor && !isNaN(cursor.getTime())) whereParts.push(sql`${listings.createdAt} < ${cursor}`);
        const where = whereParts.length ? and(...whereParts) : undefined;

        const rows = await db
          .select({
            id: listings.id,
            createdAt: listings.createdAt,
            title: listings.title,
            username: listings.username,
            price: listings.price,
            currency: listings.currency,
            sellerId: listings.sellerId,
          })
          .from(listings)
          .where(where as any)
          .orderBy(desc(listings.createdAt))
          .limit(limit);

        const sellerIds = rows.map(r => r.sellerId).filter(Boolean) as string[];
        const sellers = sellerIds.length
          ? await db.select().from(users).where(or(...sellerIds.map(id => eq(users.id, id))))
          : [];
        const byId = new Map(sellers.map(u => [u.id, u]));

        for (const r of rows) {
          chunks.push({
            kind: "listed",
            id: r.id,
            createdAt: r.createdAt,
            title: r.title,
            username: r.username,
            price: r.price,
            currency: r.currency,
            seller: byId.get(r.sellerId)?.username ?? null,
          });
        }
      }

      // ===== sold (activities.type = 'buy') =====
      {
        const whereParts: any[] = [eq(activities.type as any, "buy")];
        if (cursor && !isNaN(cursor.getTime())) whereParts.push(sql`${activities.createdAt} < ${cursor}`);
        const where = whereParts.length ? and(...whereParts) : undefined;

        const rows = await db
          .select({
            id: activities.id,
            createdAt: activities.createdAt,
            listingId: activities.listingId,
            buyerId: activities.buyerId,
            sellerId: activities.sellerId,
            amount: activities.amount,
            currency: activities.currency,
          })
          .from(activities)
          .where(where as any)
          .orderBy(desc(activities.createdAt))
          .limit(limit);

        const listingIds = Array.from(new Set(rows.map(r => r.listingId))).filter(Boolean) as string[];
        const userIds = Array.from(new Set(rows.flatMap(r => [r.buyerId, r.sellerId]))).filter(Boolean) as string[];

        const ls = listingIds.length
          ? await db.select().from(listings).where(or(...listingIds.map(id => eq(listings.id, id))))
          : [];
        const us = userIds.length
          ? await db.select().from(users).where(or(...userIds.map(id => eq(users.id, id))))
          : [];

        const L = new Map(ls.map(l => [l.id, l]));
        const U = new Map(us.map(u => [u.id, u]));

        for (const r of rows) {
          const base = L.get(r.listingId);
          if (!base) continue;
          chunks.push({
            kind: "sold",
            id: r.id,
            createdAt: r.createdAt,
            title: base.title,
            username: base.username,
            price: r.amount ?? base.price,
            currency: r.currency ?? base.currency,
            seller: U.get(r.sellerId)?.username ?? null,
            buyer: U.get(r.buyerId)?.username ?? null,
          });
        }
      }

      chunks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(chunks.slice(0, limit));
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "failed to load market activity" });
    }
  });
}