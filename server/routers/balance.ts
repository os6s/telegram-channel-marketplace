// server/routers/balance.ts
import type { Express, Request, Response } from "express";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";
import { db } from "../db.js";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema/users";

// لو ما عندك mapping للـ view، نقرأ بالتجميع المباشر:
export function mountBalance(app: Express) {
  app.get("/api/me/balance", tgAuth, async (req: Request, res: Response) => {
    try {
      const tg = (req as any).telegramUser as { id: number } | undefined;
      if (!tg?.id) return res.status(401).json({ error: "unauthorized" });

      const me = await db.query.users.findFirst({
        where: eq(users.telegramId, Number(tg.id)),
        columns: { id: true },
      });
      if (!me) return res.status(404).json({ error: "user_not_found" });

      // تجميع مباشر من جدول wallet_ledger (بدون Drizzle schema: استعلام خام)
      const row = await db.execute<{
        balance: string | null;
      }>(/* sql */`
        SELECT
          COALESCE(SUM(CASE WHEN direction='in'  THEN amount ELSE 0 END),0)
        - COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END),0) AS balance
        FROM wallet_ledger
        WHERE user_id = $1
      `, [me.id]);

      const balance = Number(row.rows?.[0]?.balance || 0);
      res.json({
        currency: "TON",
        deposits: undefined,     // (اختياري) تقدر ترجع breakdown إذا تحب
        locked: undefined,       // لم نعد نحتاج payments.locked
        balance: +balance.toFixed(9),
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "failed_to_fetch_balance" });
    }
  });
}