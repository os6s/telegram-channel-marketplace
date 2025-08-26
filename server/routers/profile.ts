// server/routers/profile.ts
import type { Express, Request, Response } from "express";
import { db } from "../db.js";
import { eq } from "drizzle-orm";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";
import { users, walletBalancesView } from "@shared/schema";
import { Address } from "@ton/core"; // ✅ better address validation

const norm = (v: unknown) => String(v ?? "").trim();

async function getMeByTelegram(req: Request) {
  const tg = (req as any).telegramUser as { id: number } | undefined;
  if (!tg?.id) return null;
  return await db.query.users.findFirst({
    where: eq(users.telegramId, BigInt(tg.id)),
  });
}

export function mountProfile(app: Express) {
  /** ✅ Current user + balance (wallet_balances_view) */
  app.get("/api/me", tgAuth, async (req: Request, res: Response) => {
    const me = await getMeByTelegram(req);
    if (!me) return res.status(404).json({ error: "user_not_found" });

    const balRow = await db
      .select({
        balance: walletBalancesView.balance,
        currency: walletBalancesView.currency,
        walletAddress: walletBalancesView.walletAddress,
      })
      .from(walletBalancesView)
      .where(eq(walletBalancesView.userId, me.id))
      .limit(1);

    const balance = Number(balRow[0]?.balance ?? 0);

    return res.json({
      ...me,
      balance: +balance.toFixed(9),
      balanceCurrency: balRow[0]?.currency ?? "TON",
      walletAddress: balRow[0]?.walletAddress ?? me.walletAddress ?? null,
    });
  });

  /** ✅ Read payout wallet */
  app.get("/api/me/wallet", tgAuth, async (req: Request, res: Response) => {
    const me = await getMeByTelegram(req);
    if (!me) return res.status(404).json({ error: "user_not_found" });
    return res.json({ walletAddress: me.walletAddress ?? null });
  });

  /** ✅ Update payout wallet */
  app.post("/api/me/wallet", tgAuth, async (req: Request, res: Response) => {
    const me = await getMeByTelegram(req);
    if (!me) return res.status(404).json({ error: "user_not_found" });

    const raw = norm(req.body?.walletAddress);

    // Clear wallet
    if (raw === "") {
      const [updated] = await db
        .update(users)
        .set({ walletAddress: null, updatedAt: new Date() })
        .where(eq(users.id, me.id))
        .returning({ walletAddress: users.walletAddress });
      return res.json({ walletAddress: updated?.walletAddress ?? null });
    }

    // Validate TON address with ton-core
    try {
      Address.parse(raw);
    } catch {
      return res.status(400).json({ error: "invalid_wallet" });
    }

    if (me.walletAddress === raw) {
      return res.json({ walletAddress: me.walletAddress });
    }

    try {
      const [updated] = await db
        .update(users)
        .set({ walletAddress: raw, updatedAt: new Date() })
        .where(eq(users.id, me.id))
        .returning({ walletAddress: users.walletAddress });

      return res.json({ walletAddress: updated?.walletAddress ?? raw });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (/duplicate key value|unique/i.test(msg)) {
        return res.status(409).json({ error: "wallet_already_in_use" });
      }
      return res.status(500).json({ error: "update_failed" });
    }
  });
}
