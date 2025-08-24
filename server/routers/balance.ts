// server/routers/balance.ts
import type { Express, Request, Response } from "express";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";
import { db } from "../db.js";
import { eq, and } from "drizzle-orm";
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

      const qCurrency = typeof req.query.currency === "string" ? req.query.currency.toUpperCase() : undefined;

      const rows = await db
        .select({
          userId: walletBalancesView.userId,
          currency: walletBalancesView.currency,
          balance: walletBalancesView.balance,
          // أعمدة اختيارية إن كانت موجودة بالفيو:
          // @ts-expect-error: optional columns may not exist in all setups
          txCount: (walletBalancesView as any).txCount,
          // @ts-expect-error: optional columns may not exist in all setups
          lastTx: (walletBalancesView as any).lastTx,
        })
        .from(walletBalancesView)
        .where(
          qCurrency
            ? and(eq(walletBalancesView.userId, me.id), eq(walletBalancesView.currency, qCurrency))
            : eq(walletBalancesView.userId, me.id)
        );

      // إذا طالب عملة محددة رجّع صف واحد (أو 0)
      if (qCurrency) {
        const r = rows[0];
        const balanceNum = Number(r?.balance ?? 0);
        return res.json({
          currency: qCurrency,
          balance: +balanceNum.toFixed(9),
          ...(r?.txCount != null ? { txCount: Number(r.txCount) } : {}),
          ...(r?.lastTx != null ? { lastTx: r.lastTx } : {}),
        });
      }

      // غير ذلك: رجّع كل العملات (أو TON=0 إذا ماكو صفوف)
      if (rows.length === 0) {
        return res.json([{ currency: "TON", balance: 0 }]);
      }

      const out = rows.map((r) => ({
        currency: r.currency || "TON",
        balance: +Number(r.balance ?? 0).toFixed(9),
        ...(r?.txCount != null ? { txCount: Number(r.txCount) } : {}),
        ...(r?.lastTx != null ? { lastTx: r.lastTx } : {}),
      }));

      res.json(out);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "failed_to_fetch_balance" });
    }
  });
}