// server/routers/wallet.ts
import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";
import { db } from "../db.js";
import {
  payments,
  users,
  walletLedger,
  walletBalancesView,
  listings,
} from "@shared/schema";
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

const ADMIN_TG_IDS = (process.env.ADMIN_TG_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function mountWallet(app: Express) {
  /** 1) Initiate deposit */
  app.post("/api/wallet/deposit/initiate", tgAuth, async (req: Request, res: Response) => {
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
    const text = encodeURIComponent(code);

    await db.insert(payments).values({
      listingId: null,
      buyerId: me.id,
      sellerId: null,
      kind: "deposit",
      locked: false,
      amount: String(amountTon),
      currency: "TON",
      feePercent: "0",   // always zero for deposit
      feeAmount: "0",
      sellerAmount: "0",
      escrowAddress: escrow,
      comment: code,
      txHash: null,
      buyerConfirmed: false,
      sellerConfirmed: false,
      status: "waiting",
      adminAction: "none",
    });

    const ton = `ton://transfer/${escrow}?amount=${amountNano}&text=${text}`;
    const tonkeeper = `tonkeeper://transfer/${escrow}?amount=${amountNano}&text=${text}`;
    const tonkeeperWeb = `https://app.tonkeeper.com/transfer/${escrow}?amount=${amountNano}&text=${text}`;
    const tonhub = `tonhub://transfer/${escrow}?amount=${amountNano}&text=${text}`;

    res.status(201).json({
      code,
      escrowAddress: escrow,
      amountTon,
      amountNano,
      deeplinks: { ton, tonkeeper, tonkeeperWeb, tonhub },
    });
  });

  /** 2) Verify deposit */
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

    if (v.txHash) {
      const dup = await db.query.payments.findFirst({
        where: and(
          eq(payments.buyerId, me.id),
          eq(payments.kind, "deposit" as any),
          eq(payments.txHash, v.txHash)
        ),
      });
      if (dup) return res.json({ status: "paid", amount: Number(dup.amount), txHash: dup.txHash });
    }

    const [updated] = await db
      .update(payments)
      .set({
        amount: String(v.amountTon),
        txHash: v.txHash ?? null,
        status: "paid",
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, waiting.id))
      .returning({ id: payments.id, amount: payments.amount, txHash: payments.txHash });

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

  /** 3) Balance */
  app.get("/api/wallet/balance", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(401).json({ error: "unauthorized" });

    const row = await db
      .select()
      .from(walletBalancesView)
      .where(eq(walletBalancesView.userId, me.id))
      .limit(1);

    const balanceNum = Number(row[0]?.balance ?? 0);
    const currency = row[0]?.currency ?? "TON";

    res.json({
      currency,
      balance: +balanceNum.toFixed(9),
    });
  });

  /** 4) Pay for a listing (lock funds in escrow) */
  app.post("/api/wallet/pay", tgAuth, async (req: Request, res: Response) => {
    try {
      const me = await getMe(req);
      if (!me) return res.status(401).json({ error: "unauthorized" });

      const listingId = String(req.body?.listingId || "");
      if (!listingId) return res.status(400).json({ error: "listing_required" });

      const listing = await db.query.listings.findFirst({
        where: eq(listings.id, listingId),
      });
      if (!listing) return res.status(404).json({ error: "listing_not_found" });

      const price = Number(listing.price);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ error: "bad_price" });
      }

      const row = await db
        .select()
        .from(walletBalancesView)
        .where(eq(walletBalancesView.userId, me.id))
        .limit(1);

      const balanceNum = Number(row[0]?.balance ?? 0);
      if (balanceNum < price) {
        return res.status(400).json({ error: "insufficient_balance" });
      }

      const [payment] = await db
        .insert(payments)
        .values({
          listingId,
          buyerId: me.id,
          sellerId: listing.sellerId,
          kind: "purchase",
          locked: true,
          amount: String(price),
          currency: "TON",
          feePercent: "5",   // reserved for later
          feeAmount: "0",    // initially zero
          sellerAmount: "0", // initially zero
          escrowAddress: process.env.ESCROW_WALLET || "",
          comment: null,
          txHash: null,
          buyerConfirmed: false,
          sellerConfirmed: false,
          status: "escrow",
          adminAction: "none",
        })
        .returning();

      await db.insert(walletLedger).values({
        userId: me.id,
        direction: "out",
        amount: String(price),
        currency: "TON",
        refType: "payment",
        refId: payment.id,
        note: "Funds locked in escrow",
      });

      res.status(201).json({ ok: true, payment });
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** 5) Admin resolve escrow (release or refund) */
  app.post("/api/wallet/resolve", tgAuth, async (req: Request, res: Response) => {
    try {
      const tg = (req as any).telegramUser;
      if (!tg?.id || !ADMIN_TG_IDS.includes(String(tg.id))) {
        return res.status(403).json({ error: "forbidden" });
      }

      const { paymentId, action } = req.body;
      if (!paymentId || !["release", "refund"].includes(action)) {
        return res.status(400).json({ error: "bad_request" });
      }

      const pay = await db.query.payments.findFirst({
        where: eq(payments.id, paymentId),
      });
      if (!pay || pay.status !== "escrow") {
        return res.status(404).json({ error: "payment_not_in_escrow" });
      }

      const amount = Number(pay.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "bad_amount" });
      }

      if (action === "release") {
        const fee = +(amount * 0.05).toFixed(9);
        const sellerAmount = +(amount - fee).toFixed(9);

        await db.insert(walletLedger).values([
          {
            userId: pay.sellerId,
            direction: "in",
            amount: String(sellerAmount),
            currency: "TON",
            refType: "payout",
            refId: pay.id,
            note: "Released to seller",
          },
          {
            userId: 0, // admin/system account
            direction: "in",
            amount: String(fee),
            currency: "TON",
            refType: "fee",
            refId: pay.id,
            note: "Admin fee",
          },
        ]);

        await db
          .update(payments)
          .set({
            feePercent: "5",
            feeAmount: String(fee),
            sellerAmount: String(sellerAmount),
            status: "released",
            adminAction: "release",
          })
          .where(eq(payments.id, pay.id));

        return res.json({ ok: true, released: sellerAmount, fee });
      }

      if (action === "refund") {
        await db.insert(walletLedger).values({
          userId: pay.buyerId,
          direction: "in",
          amount: String(amount),
          currency: "TON",
          refType: "refund",
          refId: pay.id,
          note: "Refunded to buyer",
        });

        await db
          .update(payments)
          .set({ feeAmount: "0", sellerAmount: "0", status: "refunded", adminAction: "refund" })
          .where(eq(payments.id, pay.id));

        return res.json({ ok: true, refunded: amount });
      }
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** 6) Ledger (transaction history for current user) */
  app.get("/api/wallet/ledger", tgAuth, async (req: Request, res: Response) => {
    try {
      const me = await getMe(req);
      if (!me) return res.status(401).json({ error: "unauthorized" });

      const rows = await db
        .select()
        .from(walletLedger)
        .where(eq(walletLedger.userId, me.id))
        .orderBy(desc(walletLedger.createdAt))
        .limit(50);

      res.json(rows);
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "failed_to_fetch_ledger" });
    }
  });
}