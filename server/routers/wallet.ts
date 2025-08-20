import type { Express } from "express";
import crypto from "node:crypto";
import { tgAuth } from "../middleware/tgAuth";
import { storage } from "../storage";
import { verifyTonDepositByComment } from "../ton-verify";
import type { Payment } from "@shared/schema";

const genCode = () => "D-" + crypto.randomBytes(3).toString("hex").toUpperCase();

function toNano(ton: number): string {
  const [i, fRaw = ""] = String(ton).split(".");
  const f = (fRaw + "000000000").slice(0, 9);
  const s = `${i}${f}`.replace(/^0+/, "");
  return s || "0";
}

function sum(rows: Payment[], pred: (p: Payment) => boolean) {
  return +rows.filter(pred).reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(9);
}

export function mountWallet(app: Express) {
  // بدء إيداع: يولد deeplinks + code
  app.post("/api/wallet/deposit/initiate", tgAuth, async (req, res) => {
    const escrow = (process.env.ESCROW_WALLET || "").trim();
    if (!escrow) return res.status(500).json({ error: "ESCROW_WALLET not set" });

    const amountTon = Number(req.body?.amountTon);
    if (!Number.isFinite(amountTon) || amountTon <= 0) {
      return res.status(400).json({ error: "invalid_amount" });
    }

    const code = genCode();
    const amountNano = toNano(amountTon);
    const text = encodeURIComponent(code);

    const ton = `ton://transfer/${escrow}?amount=${amountNano}&text=${text}`;
    const tonkeeper = `tonkeeper://transfer/${escrow}?amount=${amountNano}&text=${text}`;
    const tonkeeperWeb = `https://app.tonkeeper.com/transfer/${escrow}?amount=${amountNano}&text=${text}`;
    const tonhub = `tonhub://transfer/${escrow}?amount=${amountNano}&text=${text}`;

    res.json({
      code,
      escrowAddress: escrow,
      amountTon,
      amountNano,
      deeplinks: { ton, tonkeeper, tonkeeperWeb, tonhub },
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
  });

  // تحقق الإيداع بالـ code وتسجيله كرصد داخلي
  app.get("/api/wallet/deposit/status", tgAuth, async (req, res) => {
    const tgUser = (req as any).telegramUser as { id: number };
    const user = await storage.getUserByTelegramId(String(tgUser.id));
    if (!user) return res.status(400).json({ error: "user_not_found" });

    const escrow = (process.env.ESCROW_WALLET || "").trim();
    const code = String(req.query.code || "");
    const minTon = Number(req.query.minTon || "0");
    if (!escrow || !code) return res.status(400).json({ error: "bad_request" });

    const v = await verifyTonDepositByComment({
      escrow,
      code,
      minAmountTon: Number.isFinite(minTon) && minTon > 0 ? minTon : 0,
    });

    if (!v.ok) return res.json({ status: "pending" });

    const existing = (await storage.listPaymentsByBuyer(user.id))
      .find(p => p.kind === "deposit" && p.txHash === v.txHash);

    if (!existing) {
      await storage.createPayment({
        listingId: null,
        buyerId: user.id,
        kind: "deposit",
        locked: false,
        amount: String(v.amountTon),
        currency: "TON",
        feePercent: "0",
        feeAmount: "0",
        sellerAmount: "0",
        escrowAddress: escrow,
        comment: code,
        txHash: v.txHash ?? null,
        buyerConfirmed: false,
        sellerConfirmed: false,
        status: "paid",
        adminAction: "none",
      });
    }

    res.json({ status: "paid", amount: v.amountTon, txHash: v.txHash });
  });

  // رصيد داخلي محسوب من المدفوعات
  app.get("/api/wallet/balance", tgAuth, async (req, res) => {
    const tgUser = (req as any).telegramUser as { id: number };
    const me = await storage.getUserByTelegramId(String(tgUser.id));
    if (!me) return res.status(404).json({ error: "user_not_found" });

    const pays = await storage.listPaymentsByBuyer(me.id);
    const deposits = sum(pays, p => p.kind === "deposit" && p.status === "paid");
    const locked = sum(pays, p => p.kind === "order" && p.locked && (p.status === "pending" || p.status === "paid"));
    const balance = +(deposits - locked).toFixed(9);

    res.json({ deposits, locked, balance, currency: "TON" });
  });
}