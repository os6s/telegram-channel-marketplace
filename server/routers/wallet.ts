// server/routers/wallet.ts
import type { Express } from "express";
import crypto from "node:crypto";
import { tgAuth } from "../middleware/tgAuth";
import { storage } from "../storage";
import { verifyTonDepositByComment } from "../ton-verify";

// توليد كود إيداع
const genCode = () => "D-" + crypto.randomBytes(3).toString("hex").toUpperCase();

// TON -> nanoTON كسلسلة لتجنّب أخطاء الفاصلة
function toNano(ton: number): string {
  const [i, fRaw = ""] = String(ton).split(".");
  const f = (fRaw + "000000000").slice(0, 9);
  const s = `${i}${f}`.replace(/^0+/, "");
  return s || "0";
}

// جمع مبالغ payments
function sum(vals: any[], pred: (p: any) => boolean) {
  return +vals.filter(pred).reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(9);
}

export function mountWallet(app: Express) {
  /* ===================== إيداع: تهيئة ===================== */
  app.post("/api/wallet/deposit/initiate", tgAuth, async (req, res) => {
    try {
      const escrow = (process.env.ESCROW_WALLET || "").trim();
      if (!escrow) return res.status(500).json({ error: "ESCROW_WALLET not set" });

      const amountTon = Number(req.body?.amountTon);
      if (!Number.isFinite(amountTon) || amountTon <= 0) {
        return res.status(400).json({ error: "invalid_amount" });
      }

      const code = genCode();
      const amountNano = toNano(amountTon);
      const text = encodeURIComponent(code);

      // ديب‑لنكات شائعة
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
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "deposit_initiate_failed" });
    }
  });

  /* ===================== إيداع: تحقق ===================== */
  // يستعمل الكود D-XXXXXX ويقبل الزيادة ويرفض النقص إن مررت minTon
  app.get("/api/wallet/deposit/status", tgAuth, async (req, res) => {
    try {
      const tgUser = (req as any).telegramUser;
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

      // Idempotent: لا نسجل نفس txHash مرتين
      const existing = (await storage.listPaymentsByBuyer(user.id))
        .find(p => p.kind === "deposit" && p.txHash === v.txHash);

      if (!existing) {
        await storage.createPayment({
          kind: "deposit" as any,
          locked: false as any,
          buyerId: user.id,
          listingId: null as any,
          amount: String(v.amountTon),
          currency: "TON" as any,
          escrowAddress: escrow,
          status: "paid" as any,
          txHash: v.txHash!,
          feePercent: "0",
          feeAmount: "0",
          sellerAmount: "0",
        } as any);
      }

      res.json({ status: "paid", amount: v.amountTon, txHash: v.txHash });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "deposit_verify_failed" });
    }
  });

  /* ===================== رصيد داخلي ===================== */
  app.get("/api/wallet/balance", tgAuth, async (req, res) => {
    try {
      const tgUser = (req as any).telegramUser;
      const me = await storage.getUserByTelegramId(String(tgUser.id));
      if (!me) return res.status(404).json({ error: "user_not_found" });

      const pays = await storage.listPaymentsByBuyer(me.id);
      const deposits = sum(pays, p => p.kind === "deposit" && p.status === "paid");
      const locked = sum(pays, p => p.kind === "order" && p.locked && ["pending", "paid"].includes(p.status as any));
      const balance = +(deposits - locked).toFixed(9);

      res.json({ deposits, locked, balance, currency: "TON" });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "balance_failed" });
    }
  });

  /* ===================== رصيد عنوان معيّن على السلسلة (اختياري) ===================== */
  // إن أردته يبقى موجود، بدّل getTonBalance بملفك أو احذفه إن ما تحتاجه
  // app.get("/api/wallet/balance/:address", async (req, res) => { ... });
}