// server/routers/wallet.ts
import type { Express, Request } from "express";
import crypto from "node:crypto";
import { tgAuth } from "../middleware/tgAuth";
import { storage } from "../storage";
import { verifyTonDepositByComment } from "../ton-verify";
import type { Payment } from "@shared/schema";

type TgUser = { id: number };

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
  // 1) بدء إيداع: يولد كود ويحجز صف waiting مربوط بالمستخدم
  app.post("/api/wallet/deposit/initiate", tgAuth, async (req, res) => {
    const escrow = (process.env.ESCROW_WALLET || "").trim();
    if (!escrow) return res.status(500).json({ error: "ESCROW_WALLET not set" });

    const amountTon = Number(req.body?.amountTon);
    if (!Number.isFinite(amountTon) || amountTon <= 0) {
      return res.status(400).json({ error: "invalid_amount" });
    }

    const tgUser = (req as unknown as { telegramUser?: TgUser }).telegramUser;
    if (!tgUser) return res.status(401).json({ error: "unauthorized" });
    const me = await storage.getUserByTelegramId(String(tgUser.id));
    if (!me) return res.status(404).json({ error: "user_not_found" });

    const code = genCode();
    const amountNano = toNano(amountTon);
    const text = encodeURIComponent(code);

    // احجز سجل waiting حتى ما يُختطف الكود
    await storage.createPayment({
      // deposit لا يرتبط بإعلان
      listingId: (null as unknown) as any, // حقل غير nullable في بعض المخططات، استعمل null cast إذا لازم
      buyerId: me.id,
      kind: "deposit" as any,
      locked: false as any,
      amount: String(amountTon),
      currency: "TON",
      feePercent: "0",
      feeAmount: "0",
      sellerAmount: "0",
      escrowAddress: escrow,
      comment: code,       // الربط سيتم عبر هذا الكود
      txHash: null,
      buyerConfirmed: false,
      sellerConfirmed: false,
      status: "waiting" as any,
      adminAction: "none",
    });

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

  // 2) تحقق الإيداع: POST حتى لا ينكشف الكود في الـ logs، تحديث سجل waiting نفسه
  app.post("/api/wallet/deposit/status", tgAuth, async (req, res) => {
    const tgUser = (req as unknown as { telegramUser?: TgUser }).telegramUser;
    if (!tgUser) return res.status(401).json({ error: "unauthorized" });
    const user = await storage.getUserByTelegramId(String(tgUser.id));
    if (!user) return res.status(400).json({ error: "user_not_found" });

    const escrow = (process.env.ESCROW_WALLET || "").trim();
    const code = String(req.body?.code || "");
    const minTon = Number(req.body?.minTon || "0");
    if (!escrow || !code) return res.status(400).json({ error: "bad_request" });

    // دور على سجل waiting الخاص بالمستخدم والكود
    const myPays = await storage.listPaymentsByBuyer(user.id);
    const waiting = myPays.find(
      p => p.kind === "deposit" && p.status === "waiting" && (p.comment || "") === code
    );
    if (!waiting) return res.status(404).json({ status: "not_found" });

    // تحقق on-chain بالتعليق
    const v = await verifyTonDepositByComment({
      escrow,
      code,
      minAmountTon: Number.isFinite(minTon) && minTon > 0 ? minTon : 0,
    });

    if (!v.ok) return res.json({ status: "pending" });

    // منع تكرار المطالبة لنفس المستخدم وtx
    const already = myPays.find(p => p.kind === "deposit" && p.txHash && v.txHash && p.txHash === v.txHash);
    if (already) {
      // لو سجلنا مسبقًا كـ paid رجّع الحالة
      return res.json({ status: "paid", amount: Number(already.amount), txHash: already.txHash });
    }

    // حدّث نفس السجل
    const updated = await storage.updatePayment(waiting.id, {
      amount: String(v.amountTon),
      txHash: v.txHash ?? null,
      status: "paid" as any,
      confirmedAt: new Date() as any,
    });

    res.json({ status: "paid", amount: v.amountTon, txHash: v.txHash, id: updated?.id });
  });

  // 3) رصيد داخلي
  app.get("/api/wallet/balance", tgAuth, async (req, res) => {
    const tgUser = (req as unknown as { telegramUser?: TgUser }).telegramUser;
    if (!tgUser) return res.status(401).json({ error: "unauthorized" });
    const me = await storage.getUserByTelegramId(String(tgUser.id));
    if (!me) return res.status(404).json({ error: "user_not_found" });

    const pays = await storage.listPaymentsByBuyer(me.id);
    const deposits = sum(pays, p => p.kind === "deposit" && p.status === "paid");
    const locked   = sum(pays, p => p.kind === "order" && p.locked && (p.status === "pending" || p.status === "paid"));
    const balance  = +(deposits - locked).toFixed(9);

    res.json({ deposits, locked, balance, currency: "TON" });
  });
}