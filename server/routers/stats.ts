// server/routers/stats.ts
import type { Express } from "express";
import { storage } from "../storage";

export function mountStats(app: Express) {
  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getMarketplaceStats();
      res.json(stats);
    } catch (error:any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });
}