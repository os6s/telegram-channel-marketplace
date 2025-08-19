// server/routers/market-activity.ts
import type { Express } from "express";
import { db } from "../db";
import { listings, activities, users } from "@shared/schema";
import { desc, eq, or, and, sql } from "drizzle-orm";

/**
 * GET /api/market-activity
 * Query:
 *   types? = comma-separated of: listed,sold,price_update  (default: all)
 *   limit? = number (default 30)
 *   cursor? = ISO date string for pagination (return items createdAt < cursor)
 *
 * Response: [{ id, kind: 'listed'|'sold'|'price_update', createdAt, title, username, price, currency, seller, buyer, oldPrice, newPrice }]
 */
export function mountMarketActivity(app: Express) {
  app.get("/api/market-activity", async (req, res) => {
    try {
      const typesParam = String(req.query.types || "").trim();
      const limit = Math.min(Math.max(Number(req.query.limit ?? 30), 1), 100);
      const cursor = req.query.cursor ? new Date(String(req.query.cursor)) : null;

      const includeListed = !typesParam || typesParam.split(",").includes("listed");
      const includeSold = !typesParam || typesParam.split(",").includes("sold");
      const includePrice = !typesParam || typesParam.split(",").includes("price_update");

      const chunks: any[] = [];

      if (includeListed) {
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

        // resolve seller username
        const sellerIds = rows.map((r) => r.sellerId);
        const sellers =
          sellerIds.length
            ? await db.select().from(users).where(or(...sellerIds.map((id) => eq(users.id, id))))
            : [];

        const byId = new Map(sellers.map((u) => [u.id, u]));
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

      if (includeSold || includePrice) {
        const whereParts: any[] = [];
        if (cursor && !isNaN(cursor.getTime())) whereParts.push(sql`${activities.createdAt} < ${cursor}`);
        // نجيب buy و price_update من جدول activities
        const typeConds = [];
        if (includeSold) typeConds.push(eq(activities.type, "buy" as any));
        if (includePrice) typeConds.push(eq(activities.type, "price_update" as any));
        if (typeConds.length) whereParts.push(or(...typeConds as any));
        const where = whereParts.length ? and(...whereParts) : undefined;

        const rows = await db
          .select({
            id: activities.id,
            createdAt: activities.createdAt,
            type: activities.type,
            listingId: activities.listingId,
            buyerId: activities.buyerId,
            sellerId: activities.sellerId,
            amount: activities.amount,
            currency: activities.currency,
            note: activities.note,
          })
          .from(activities)
          .where(where as any)
          .orderBy(desc(activities.createdAt))
          .limit(limit);

        const listingIds = Array.from(new Set(rows.map((r) => r.listingId)));
        const userIds = Array.from(new Set(rows.flatMap((r) => [r.buyerId, r.sellerId])));

        const ls = listingIds.length
          ? await db.select().from(listings).where(or(...listingIds.map((id) => eq(listings.id, id))))
          : [];
        const us = userIds.length
          ? await db.select().from(users).where(or(...userIds.map((id) => eq(users.id, id))))
          : [];

        const L = new Map(ls.map((l: any) => [l.id, l]));
        const U = new Map(us.map((u: any) => [u.id, u]));

        for (const r of rows) {
          const base = L.get(r.listingId);
          if (!base) continue;

          if (r.type === "buy") {
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
          } else if (r.type === "price_update") {
            // note بصيغة JSON: { oldPrice, newPrice }
            let oldPrice: string | null = null;
            let newPrice: string | null = null;
            try {
              const j = r.note ? JSON.parse(r.note) : null;
              oldPrice = j?.oldPrice ?? null;
              newPrice = j?.newPrice ?? null;
            } catch {}

            chunks.push({
              kind: "price_update",
              id: r.id,
              createdAt: r.createdAt,
              title: base.title,
              username: base.username,
              currency: base.currency,
              oldPrice,
              newPrice,
              seller: U.get(r.sellerId)?.username ?? null,
            });
          }
        }
      }

      // رتبهم حسب التاريخ ونقص للـ limit النهائي
      chunks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(chunks.slice(0, limit));
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "failed to load market activity" });
    }
  });
}