import type { Express } from "express";
import { tgAuth } from "../middleware/tgAuth";
import { storage } from "../storage";
import type { Payment } from "@shared/schema";

function sum(rows: Payment[], pred: (p: Payment) => boolean) {
  return +rows.filter(pred).reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(9);
}

export function mountBalance(app: Express) {
  app.get("/api/me/balance", tgAuth, async (req, res) => {
    const me = await storage.getUserByTelegramId(String((req as any).telegramUser.id));
    if (!me) return res.status(404).json({ error: "user_not_found" });

    const pays = await storage.listPaymentsByBuyer(me.id);
    const deposits = sum(pays, p => p.kind === "deposit" && p.status === "paid"));
    const locked = sum(pays, p => p.kind === "order" && p.locked && (p.status === "pending" || p.status === "paid")));
    const balance = +(deposits - locked).toFixed(9);

    res.json({ deposits, locked, balance, currency: "TON" });
  });
}