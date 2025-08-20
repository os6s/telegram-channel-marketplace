import type { Express } from "express";
import { tgAuth } from "../middleware/tgAuth";
import { storage } from "../storage";
import type { Payment } from "@shared/schema";

async function computeBalance(userId: string) {
  const pays = await storage.listPaymentsByBuyer(userId);
  const deposits = +pays.filter(p => p.kind === "deposit" && p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0).toFixed(9);
  const locked = +pays.filter(p => p.kind === "order" && p.locked && (p.status === "pending" || p.status === "paid"))
    .reduce((s, p) => s + Number(p.amount), 0).toFixed(9);
  return +(deposits - locked).toFixed(9);
}

export function mountPayouts(app: Express) {
  // طلب سحب
  app.post("/api/payouts/request", tgAuth, async (req, res) => {
    const me = await storage.getUserByTelegramId(String((req as any).telegramUser.id));
    if (!me) return res.status(404).json({ error: "user_not_found" });

    const addr = me.walletAddress;
    if (!addr) return res.status(400).json({ error: "wallet_required" });

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "invalid_amount" });

    const balance = await computeBalance(me.id);
    if (amount > balance) return res.status(400).json({ error: "insufficient_balance", balance });

    const reqPayout = await storage.createPayout({
      paymentId: null,
      sellerId: me.id,
      toAddress: addr,
      amount: String(amount),
      currency: "TON",
      status: "queued",
      note: "user_withdrawal",
      txHash: null,
    });

    res.status(201).json(reqPayout);
  });

  // قائمة طلباتي
  app.get("/api/payouts/my", tgAuth, async (req, res) => {
    const me = await storage.getUserByTelegramId(String((req as any).telegramUser.id));
    if (!me) return res.status(404).json({ error: "user_not_found" });
    const rows = await storage.listPayoutsBySeller(me.id);
    res.json(rows);
  });
}