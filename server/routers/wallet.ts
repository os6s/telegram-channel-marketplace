// server/routers/wallet.ts
import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";
import { db } from "../db.js";
import { payments, users, walletLedger, walletBalancesView } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { verifyTonDepositByComment } from "../ton-verify.js";
import { Address } from "@ton/core"; // ✅ proper TON address validation

type TgUser = { id: number };

const genCode = () => "D" + crypto.randomBytes(4).toString("hex"); // comment code (no spaces/underscores)

function toNano(ton: number): string {
  const [i, fRaw = ""] = String(ton).split(".");
  const f = (fRaw + "000000000").slice(0, 9);
  const s = `${i}${f}`.replace(/^0+/, "");
  return s || "0";
}

async function getMe(req: Request) {
  const tg = (req as any).telegramUser as TgUser | undefined;
  if (!tg?.id) return null;
  return await db.query.users.findFirst({
    where: eq(users.telegramId, BigInt(tg.id)),
  });
}

function isValidTonAddress(addr: string): boolean {
  try {
    Address.parse(addr.trim()); // ✅ use ton-core to validate
    return true;
  } catch {
    return false;
  }
}

export function mountWallet(app: Express) {
  /** ✅ 1) Wallet Address APIs */
  app.get("/api/wallet/address", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

    res.json({ ok: true, walletAddress: (me as any).wallet_address ?? null });
  });

  app.post("/api/wallet/address", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

    const addr = String(req.body?.walletAddress || "").trim();
    if (!isValidTonAddress(addr)) {
      return res.status(400).json({ ok: false, error: "invalid_address" });
    }

    const [updated] = await db
      .update(users)
      .set({ wallet_address: addr, updatedAt: new Date() })
      .where(eq(users.id, me.id))
      .returning({ id: users.id, wallet_address: users.wallet_address });

    console.log(`✅ Wallet linked for user ${me.id}: ${addr}`);
    res.json({ ok: true, walletAddress: updated.wallet_address });
  });

  app.delete("/api/wallet/address", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

    await db
      .update(users)
      .set({ wallet_address: null, updatedAt: new Date() })
      .where(eq(users.id, me.id));

    console.log(`❌ Wallet unlinked for user ${me.id}`);
    res.json({ ok: true, walletAddress: null });
  });

  /** ✅ 2) Initiate deposit (TonConnect payload) */
  app.post("/api/wallet/deposit/initiate", tgAuth, async (req: Request, res: Response) => {
    try {
      const escrow = (process.env.ESCROW_WALLET || "").trim();
      if (!escrow) return res.status(500).json({ ok: false, error: "ESCROW_WALLET not set" });

      const amountTon = Number(req.body?.amountTon);
      if (!Number.isFinite(amountTon) || amountTon <= 0) {
        return res.status(400).json({ ok: false, error: "invalid_amount" });
      }

      const me = await getMe(req);
      if (!me) return res.status(404).json({ ok: false, error: "user_not_found" });

      if (!(me as any).wallet_address) {
        return res.status(400).json({ ok: false, error: "wallet_not_linked" });
      }

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

      // ✅ safer TonConnect payload using comment field
      const payload = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: escrow,
            amount: amountNano,
            stateInit: null,
            payload: null,
            text: code, // use as comment
          },
        ],
      };

      res.status(201).json({
        ok: true,
        code,
        escrowAddress: escrow,
        amountTon,
        amountNano,
        txPayload: payload,
      });
    } catch (e: unknown) {
      const err = e as Error;
      console.error("deposit/initiate error:", err);
      res.status(500).json({ ok: false, error: err?.message || "deposit_initiate_failed" });
    }
  });

  /** ✅ 3) Verify deposit */
  app.post("/api/wallet/deposit/status", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

    const escrow = (process.env.ESCROW_WALLET || "").trim();
    const code = String(req.body?.code || "");
    const minTon = Number(req.body?.minTon || "0");
    if (!escrow || !code) return res.status(400).json({ ok: false, error: "bad_request" });

    const waiting = await db.query.payments.findFirst({
      where: and(
        eq(payments.buyerId, me.id),
        eq(payments.kind, "deposit" as any),
        eq(payments.status, "waiting" as any),
        eq(payments.comment, code)
      ),
      orderBy: desc(payments.createdAt),
    });
    if (!waiting) return res.status(404).json({ ok: false, status: "not_found" });

    const v = await verifyTonDepositByComment({
      escrow,
      code,
      minAmountTon: Number.isFinite(minTon) && minTon > 0 ? minTon : 0,
    });

    if (!v.ok) return res.json({ ok: true, status: "pending" });

    const [updated] = await db.update(payments).set({
      amount: String(v.amountTon),
      txHash: v.txHash ?? null,
      status: "paid",
      confirmedAt: new Date(),
      updatedAt: new Date(),
    }).where(
      and(eq(payments.id, waiting.id), eq(payments.status, "waiting")) // ✅ double-spend safe
    ).returning();

    await db.insert(walletLedger).values({
      userId: me.id,
      direction: "in",
      amount: String(v.amountTon),
      currency: "TON",
      refType: "deposit",
      refId: updated.id,
      note: "Deposit confirmed",
    });

    res.json({ ok: true, status: "paid", amount: Number(updated.amount), txHash: updated.txHash, id: updated.id });
  });

  /** ✅ 4) Balance */
  app.get("/api/wallet/balance", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

    const row = await db.select().from(walletBalancesView).where(eq(walletBalancesView.userId, me.id)).limit(1);
    res.json({
      ok: true,
      currency: row[0]?.currency ?? "TON",
      balance: (Number(row[0]?.balance ?? 0)).toFixed(9), // ✅ keep string for precision
    });
  });

  /** ✅ 5) Ledger */
  app.get("/api/wallet/ledger", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

    const rows = await db
      .select()
      .from(walletLedger)
      .where(eq(walletLedger.userId, me.id))
      .orderBy(desc(walletLedger.createdAt))
      .limit(50);

    res.json({ ok: true, rows });
  });
}
