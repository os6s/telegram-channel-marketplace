// server/routers/market-activity.ts
import type { Express } from "express";
import { db } from "../db";
import { and, desc, lt } from "drizzle-orm";

// استيراد موحّد من الإندكس
import { marketActivityView } from "@shared/schema";

/**
 * GET /api/market-activity
 * Query:
 *   limit?  (default 30, max 100)
 *   cursor? (ISO datetime؛ يرجّع عناصر createdAt < cursor)
 *
 * يعرض بيانات موحّدة من الـ VIEW: market_activity_view (مربوط كـ marketActivityView)
 * الأعمدة: id, createdAt, kind, title, username, amount, currency, seller, buyer
 */
export function mountMarketActivity(app: Express) {
  app.get("/api/market-activity", async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit ?? 30), 1), 100);
      const cursorStr = typeof req.query.cursor === "string" ? req.query.cursor : "";
      const cursor = cursorStr ? new Date(cursorStr) : null;

      const where = cursor && !isNaN(cursor.getTime())
        ? and(lt(marketActivityView.createdAt, cursor))
        : undefined;

      const rows = await db
        .select({
          id: marketActivityView.id,
          createdAt: marketActivityView.createdAt,
          kind: marketActivityView.kind,
          title: marketActivityView.title,
          username: marketActivityView.username,
          amount: marketActivityView.amount,
          currency: marketActivityView.currency,
          seller: marketActivityView.seller,
          buyer: marketActivityView.buyer,
        })
        .from(marketActivityView)
        .where(where)
        .orderBy(desc(marketActivityView.createdAt))
        .limit(limit);

      // نطابق شكل الاستجابة السابق (price = amount)
      const out = rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        createdAt: r.createdAt,
        title: r.title,
        username: r.username,
        price: r.amount,
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