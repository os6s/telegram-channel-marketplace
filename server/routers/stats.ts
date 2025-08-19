// server/routers/stats.ts
import type { Express } from "express";
import { storage } from "../storage";

export function mountStats(app: Express) {
  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getMarketplaceStats();
      res.set("Cache-Control", "public, max-age=30"); // 30 ثانية
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });
}