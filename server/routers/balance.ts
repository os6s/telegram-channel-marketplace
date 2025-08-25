// server/routers/balance.ts
import type { Express, Request, Response } from "express";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";
import { db } from "../db.js";
import { eq, and, desc } from "drizzle-orm";
import { users, walletBalancesView, walletLedger } from "@shared/schema";

async function getMe(req: Request) {
  const tg = (req as any).telegramUser as { id: number } | undefined;
  if (!tg?.id) return null;
  return await db.query.users.findFirst({
    where: eq(users.telegramId, Number(tg.id)),
    columns: { id: true, username: true },
  });
}

export function mountBalance(app: Express) {
  /** GET /api/me/balance */
  app.get("/api/me/balance", tgAuth, async (req: Request, res: Response) => {
    try {
      const me = await getMe(req);
      if (!me) return res.status(401).json({ error: "unauthorized" });

      const qCurrency =
        typeof req.query.currency === "string"
          ? req.query.currency.toUpperCase()
          : undefined;

      const rows = await db
        .select({
          userId: walletBalancesView.userId,
          currency: walletBalancesView.currency,
          balance: walletBalancesView.balance,
          // optional columns
          // @ts-expect-error
          txCount: (walletBalancesView as any).txCount,
          // @ts-expect-error
          lastTx: (walletBalancesView as any).lastTx,
        })
        .from(walletBalancesView)
        .where(
          qCurrency
            ? and(
                eq(walletBalancesView.userId, me.id),
                eq(walletBalancesView.currency, qCurrency)
              )
            : eq(walletBalancesView.userId, me.id)
        );

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
      res
        .status(500)
        .json({ error: e?.message || "failed_to_fetch_balance" });
    }
  });

  /** GET /api/me/transactions (ledger history) */
  app.get(
    "/api/me/transactions",
    tgAuth,
    async (req: Request, res: Response) => {
      try {
        const me = await getMe(req);
        if (!me) return res.status(401).json({ error: "unauthorized" });

        const limit = Math.min(
          Number(req.query.limit) || 50,
          200
        ); // max 200
        const rows = await db
          .select()
          .from(walletLedger)
          .where(eq(walletLedger.userId, me.id))
          .orderBy(desc(walletLedger.createdAt))
          .limit(limit);

        res.json(rows);
      } catch (e: any) {
        res
          .status(500)
          .json({ error: e?.message || "failed_to_fetch_transactions" });
      }
    }
  );
}