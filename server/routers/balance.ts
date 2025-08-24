// server/routers/balance.ts
import type { Express, Request, Response } from "express";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";
import { db } from "../db.js";
import { eq } from "drizzle-orm";
import { users, walletBalancesView } from "@shared/schema";

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

      const row = await db
        .select()
        .from(walletBalancesView)
        .where(eq(walletBalancesView.userId, me.id))
        .limit(1);

      const balanceNum = Number(row[0]?.balance ?? 0);
      const currency = row[0]?.currency ?? "TON";

      res.json({
        currency,
        balance: +balanceNum.toFixed(9),
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "failed_to_fetch_balance" });
    }
  });
}