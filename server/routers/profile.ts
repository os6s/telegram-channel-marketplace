// server/routers/profile.ts
import type { Express } from "express";
import { tgAuth } from "../middleware/tgAuth";
import { storage } from "../storage";

const RE_TON_ADDR = /^E[QA][A-Za-z0-9_-]{46,}$/; // base64url (bounceable/non-bounceable)

/** Normalizes TON addr input (trim only; keep as provided to avoid wrong transforms). */
function normAddr(v: unknown) {
  return String(v ?? "").trim();
}

export function mountProfile(app: Express) {
  // Get my basic profile (handy for front-end)
  app.get("/api/me", tgAuth, async (req, res) => {
    const me = await storage.getUserByTelegramId(String((req as any).telegramUser.id));
    if (!me) return res.status(404).json({ error: "user_not_found" });
    res.json(me);
  });

  // Get my wallet
  app.get("/api/me/wallet", tgAuth, async (req, res) => {
    const me = await storage.getUserByTelegramId(String((req as any).telegramUser.id));
    if (!me) return res.status(404).json({ error: "user_not_found" });
    res.json({ walletAddress: me.walletAddress ?? null });
  });

  // Set / update my wallet (reject invalid; allow clearing with empty string)
  app.post("/api/me/wallet", tgAuth, async (req, res) => {
    const me = await storage.getUserByTelegramId(String((req as any).telegramUser.id));
    if (!me) return res.status(404).json({ error: "user_not_found" });

    const raw = normAddr(req.body?.walletAddress);
    if (raw === "") {
      const updated = await storage.updateUser(me.id, { walletAddress: null as any });
      return res.json({ walletAddress: updated?.walletAddress ?? null });
    }

    if (!RE_TON_ADDR.test(raw)) return res.status(400).json({ error: "invalid_wallet" });
    if (me.walletAddress === raw) return res.status(200).json({ walletAddress: me.walletAddress });

    const updated = await storage.updateUser(me.id, { walletAddress: raw });
    res.json({ walletAddress: updated?.walletAddress ?? raw });
  });
}