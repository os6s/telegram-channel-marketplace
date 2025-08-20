import type { Express } from "express";
import { tgAuth } from "../middleware/tgAuth";
import { storage } from "../storage";

const RE_TON_ADDR = /^E[QA][A-Za-z0-9_-]{46,}$/;

export function mountProfile(app: Express) {
  app.get("/api/me/wallet", tgAuth, async (req, res) => {
    const me = await storage.getUserByTelegramId(String((req as any).telegramUser.id));
    if (!me) return res.status(404).json({ error: "user_not_found" });
    res.json({ walletAddress: me.walletAddress ?? null });
  });

  app.post("/api/me/wallet", tgAuth, async (req, res) => {
    const addr = String(req.body?.walletAddress || "").trim();
    if (!RE_TON_ADDR.test(addr)) return res.status(400).json({ error: "invalid_wallet" });
    const me = await storage.getUserByTelegramId(String((req as any).telegramUser.id));
    if (!me) return res.status(404).json({ error: "user_not_found" });
    const updated = await storage.updateUser(me.id, { walletAddress: addr });
    res.json({ walletAddress: updated?.walletAddress ?? null });
  });
}