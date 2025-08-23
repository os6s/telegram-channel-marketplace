// server/routers/market-activity.ts
import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * GET /api/market-activity
 * Query:
 *   limit?  (default 30, max 100)
 *   cursor? (ISO datetime؛ يرجّع عناصر created_at < cursor)
 *
 * يعرض بيانات موحّدة من الـ VIEW: market_activity
 * الأعمدة المتوقعة في الـ VIEW:
 *   id, created_at, kind, title, username, amount, currency, seller, buyer
 */
export function mountMarketActivity(app: Express) {
  app.get("/api/market-activity", async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit ?? 30), 1), 100);
      const cursorStr = typeof req.query.cursor === "string" ? req.query.cursor : "";
      const cursor = cursorStr ? new Date(cursorStr) : null;

      // نبني شرط cursor إن وجد
      const whereSql = cursor && !isNaN(cursor.getTime())
        ? sql`WHERE created_at < ${cursor}`
        : sql``;

      // ملاحظة: نقرأ مباشرة من الـ VIEW "market_activity"
      const rows = await db.execute<{
        id: string;
        created_at: string;
        kind: string;
        title: string | null;
        username: string | null;
        amount: string | null;
        currency: string | null;
        seller: string | null;
        buyer: string | null;
      }>(sql`
        SELECT
          id,
          created_at,
          kind,
          title,
          username,
          amount,
          currency,
          seller,
          buyer
        FROM market_activity
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);

      // نطابق شكل الاستجابة السابق (camelCase + price=amount)
      const out = rows.rows.map((r) => ({
        id: r.id,
        kind: r.kind, // 'listed' | 'sold' | 'updated' | 'cancel' | 'other' حسب الـ VIEW
        createdAt: r.created_at,
        title: r.title,
        username: r.username,
        price: r.amount,          // نفس العامود amount من الـ VIEW
        currency: r.currency,
        seller: r.seller,
        buyer: r.buyer,
      }));

      res.json(out);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "failed to load market activity" });
    }
  });
}