// server/routers/wallet.ts
import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";
import { db } from "../db.js";
import { payments, users, walletLedger, walletBalancesView } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { verifyTonDepositByComment } from "../ton-verify.js";

type TgUser = { id: number };

const genCode = () => "D-" + crypto.randomBytes(3).toString("hex").toUpperCase();

function toNano(ton: number): string {
  const [i, fRaw = ""] = String(ton).split(".");
  const f = (fRaw + "000000000").slice(0, 9);
  const s = `${i}${f}`.replace(/^0+/, "");
  return s || "0";
}

async function getMe(req: Request) {
  const tg = (req as any).telegramUser as TgUser | undefined;
  if (!tg?.id) return null;
  const me = await db.query.users.findFirst({
    where: eq(users.telegramId, BigInt(tg.id)),
  });
  return me ?? null;
}

export function mountWallet(app: Express) {
  /** ✅ 1) Initiate deposit (TonConnect payload) */
  app.post("/api/wallet/deposit/initiate", tgAuth, async (req: Request, res: Response) => {
    try {
      const escrow = (process.env.ESCROW_WALLET || "").trim();
      if (!escrow) return res.status(500).json({ error: "ESCROW_WALLET not set" });

      const amountTon = Number(req.body?.amountTon);
      if (!Number.isFinite(amountTon) || amountTon <= 0) {
        return res.status(400).json({ error: "invalid_amount" });
      }

      const me = await getMe(req);
      if (!me) return res.status(404).json({ error: "user_not_found" });

      const code = genCode();
      const amountNano = toNano(amountTon);

      const [row] = await db.insert(payments).values({
        listingId: null,
        buyerId: me.id,
        sellerId: null,
        kind: "deposit",
        locked: false,
        amount: String(amountTon),
        currency: "TON",
        feePercent: "0",
        feeAmount: "0",
        sellerAmount: "0",
        escrowAddress: escrow,
        comment: code,
        txHash: null,
        buyerConfirmed: false,
        sellerConfirmed: false,
        status: "waiting",
        adminAction: "none",
      }).returning();

      // ✅ TonConnect payload
      const payload = {
        validUntil: Math.floor(Date.now() / 1000) + 300, // 5 min
        messages: [
          {
            address: escrow,
            amount: amountNano,
            payload: Buffer.from(code).toString("base64"),
          },
        ],
      };

      res.status(201).json({
        code,
        escrowAddress: escrow,
        amountTon,
        amountNano,
        txPayload: payload,
        fallbackDeeplinks: {
          tonkeeper: `tonkeeper://transfer/${escrow}?amount=${amountNano}&text=${encodeURIComponent(code)}`,
          tonhub: `tonhub://transfer/${escrow}?amount=${amountNano}&text=${encodeURIComponent(code)}`,
        },
      });
    } catch (e: any) {
      console.error("deposit/initiate error:", e);
      res.status(500).json({ error: e?.message || "deposit_initiate_failed" });
    }
  });

  /** ✅ 2) Verify deposit */
  app.post("/api/wallet/deposit/status", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(401).json({ error: "unauthorized" });

    const escrow = (process.env.ESCROW_WALLET || "").trim();
    const code = String(req.body?.code || "");
    const minTon = Number(req.body?.minTon || "0");
    if (!escrow || !code) return res.status(400).json({ error: "bad_request" });

    const waiting = await db.query.payments.findFirst({
      where: and(
        eq(payments.buyerId, me.id),
        eq(payments.kind, "deposit" as any),
        eq(payments.status, "waiting" as any),
        eq(payments.comment, code)
      ),
      orderBy: desc(payments.createdAt),
    });
    if (!waiting) return res.status(404).json({ status: "not_found" });

    const v = await verifyTonDepositByComment({
      escrow,
      code,
      minAmountTon: Number.isFinite(minTon) && minTon > 0 ? minTon : 0,
    });

    if (!v.ok) return res.json({ status: "pending" });

    const [updated] = await db.update(payments).set({
      amount: String(v.amountTon),
      txHash: v.txHash ?? null,
      status: "paid",
      confirmedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(payments.id, waiting.id)).returning();

    await db.insert(walletLedger).values({
      userId: me.id,
      direction: "in",
      amount: String(v.amountTon),
      currency: "TON",
      refType: "deposit",
      refId: updated.id,
      note: "Deposit confirmed",
    });

    res.json({ status: "paid", amount: Number(updated.amount), txHash: updated.txHash, id: updated.id });
  });

  /** ✅ 3) Balance */
  app.get("/api/wallet/balance", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(401).json({ error: "unauthorized" });

    const row = await db.select().from(walletBalancesView).where(eq(walletBalancesView.userId, me.id)).limit(1);
    res.json({
      currency: row[0]?.currency ?? "TON",
      balance: +(Number(row[0]?.balance ?? 0)).toFixed(9),
    });
  });

  /** ✅ 4) Ledger */
  app.get("/api/wallet/ledger", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(401).json({ error: "unauthorized" });

    const rows = await db.select().from(walletLedger).where(eq(walletLedger.userId, me.id)).orderBy(desc(walletLedger.createdAt)).limit(50);
    res.json(rows);
  });
}