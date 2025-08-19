// server/routers/wallet.ts
import type { Express } from "express";
import { storage } from "../storage";
import { getTonBalance } from "../ton-utils";

export function mountWallet(app: Express) {
  // رصيد المستخدم الحالي
  app.get("/api/wallet/balance", async (req, res) => {
    try {
      const userId = (req as any).session?.userId || req.query.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(String(userId));
      if (!user?.tonWallet) return res.status(400).json({ error: "Wallet not set" });

      const balance = await getTonBalance(user.tonWallet);
      res.json({ address: user.tonWallet, balanceTON: balance });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to fetch balance" });
    }
  });

  // رصيد عنوان معيّن
  app.get("/api/wallet/balance/:address", async (req, res) => {
    try {
      const balance = await getTonBalance(req.params.address);
      res.json({ address: req.params.address, balanceTON: balance });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Failed to fetch balance" });
    }
  });
}