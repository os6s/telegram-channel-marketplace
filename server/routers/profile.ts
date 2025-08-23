// server/routers/profile.ts
import type { Express, Request, Response } from "express";
import { db } from "../db.js";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";

// Base64url TON addresses (bounceable/non‑bounceable, friendly format)
const RE_TON_ADDR = /^E[QA][A-Za-z0-9_-]{46,}$/;

const norm = (v: unknown) => String(v ?? "").trim();

async function getMeByTelegram(req: Request) {
  const tg = (req as any).telegramUser as { id: number } | undefined;
  if (!tg?.id) return null;
  const row = await db.query.users.findFirst({
    where: eq(users.telegramId, BigInt(tg.id)),
  });
  return row ?? null;
}

export function mountProfile(app: Express) {
  // Current user (creates is handled elsewhere; هنا فقط قراءة)
  app.get("/api/me", tgAuth, async (req: Request, res: Response) => {
    const me = await getMeByTelegram(req);
    if (!me) return res.status(404).json({ error: "user_not_found" });
    return res.json(me);
  });

  // Read payout wallet (wallet_address)
  app.get("/api/me/wallet", tgAuth, async (req: Request, res: Response) => {
    const me = await getMeByTelegram(req);
    if (!me) return res.status(404).json({ error: "user_not_found" });
    return res.json({ walletAddress: me.walletAddress ?? null });
  });

  // Update payout wallet (wallet_address)
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

    // Validate TON friendly address format
    if (!RE_TON_ADDR.test(raw)) {
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
      // احتمال فشل بسبب UNIQUE constraint
      const msg = String(e?.message || "");
      if (/duplicate key value|unique/i.test(msg)) {
        return res.status(409).json({ error: "wallet_already_in_use" });
      }
      return res.status(500).json({ error: "update_failed" });
    }
  });
}