// server/routers/wallet.ts
import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";
import { db } from "../db.js";
import { payments, users, walletLedger, walletBalancesView } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { verifyTonDepositByComment } from "../ton-verify.js";
import { Address, beginCell } from "@ton/core";

type TgUser = { id: number };

/* ========================= Helpers ========================= */

function toNano(ton: number): string {
  if (!Number.isFinite(ton) || ton <= 0) return "0";
  const [iRaw, fRaw = ""] = String(ton).trim().split(".");
  const i = (iRaw || "0").replace(/^0+(?=\d)/, "") || "0";
  const frac = (fRaw + "000000000").slice(0, 9);
  return (BigInt(i) * 1000000000n + BigInt(frac || "0")).toString();
}

async function getMe(req: Request) {
  const tg = (req as any).telegramUser as TgUser | undefined;
  if (!tg?.id) return null;
  const rows = await db
    .select({
      id: users.id,
      telegramId: users.telegramId,
      walletAddress: users.walletAddress, // camelCase في الـ schema المشاركة
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.telegramId, BigInt(tg.id)))
    .limit(1);
  return rows[0] ?? null;
}

/** طبع عنوان TON بصيغة UQ (non-bounceable) مع احترام الشبكة */
function normalizeTonAddressStrict(input: string): string {
  const cleaned = String(input ?? "")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF\r\n\t ]+/g, "");
  if (!cleaned) throw new Error("empty");
  const isTestnet = (process.env.TON_NETWORK || "mainnet") !== "mainnet";
  return Address.parse(cleaned).toString({ bounceable: false, testOnly: isTestnet });
}

const jsonSafe = (_k: string, v: any) => (typeof v === "bigint" ? v.toString() : v);

/* ========================= Mount ========================= */

export function mountWallet(app: Express) {
  /** 1) Wallet address management (محمي داخل TMA فقط) */
  app.get("/api/wallet/address", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });
    res.json({ ok: true, walletAddress: me.walletAddress ?? null });
  });

  app.post("/api/wallet/address", tgAuth, async (req: Request, res: Response) => {
    try {
      const me = await getMe(req);
      if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

      const body = req.body as any;
      const rawInput =
        typeof body?.walletAddress === "string"
          ? body.walletAddress
          : body?.walletAddress?.address;

      const input = String(rawInput ?? "").trim();

      // unlink
      if (!input) {
        await db.update(users)
          .set({ walletAddress: null, updatedAt: new Date() })
          .where(eq(users.id, me.id));
        return res.json({ ok: true, walletAddress: null });
      }

      // validate to UQ
      let pretty: string;
      try {
        pretty = normalizeTonAddressStrict(input);
      } catch {
        return res.status(400).json({ ok: false, error: "invalid_address" });
      }

      await db.update(users)
        .set({ walletAddress: pretty, updatedAt: new Date() })
        .where(eq(users.id, me.id));

      return res.json({ ok: true, walletAddress: pretty });
    } catch (e: any) {
      console.error("wallet/address error:", e, "body:", req.body);
      return res.status(400).json({ ok: false, error: "invalid_address" });
    }
  });

  app.delete("/api/wallet/address", tgAuth, async (req: Request, res: Response) => {
    try {
      const me = await getMe(req);
      if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

      await db.update(users)
        .set({ walletAddress: null, updatedAt: new Date() })
        .where(eq(users.id, me.id));

      return res.json({ ok: true, walletAddress: null });
    } catch (e) {
      console.error("wallet/address delete error:", e);
      return res.status(500).json({ ok: false, error: "wallet_unlink_failed" });
    }
  });

  /** 2) Deposit initiate (بدون tgAuth حتى يشتغل خارج TMA) */
  app.post("/api/wallet/deposit/initiate", async (req: Request, res: Response) => {
    try {
      const escrowRaw = (process.env.ESCROW_WALLET || "").trim();
      if (!escrowRaw) return res.status(500).json({ ok: false, error: "ESCROW_WALLET not set" });

      // UQ حسب الشبكة
      const isTest = (process.env.TON_NETWORK || "mainnet") !== "mainnet";
      let escrow: string;
      try {
        escrow = Address.parse(escrowRaw).toString({ bounceable: false, testOnly: isTest });
      } catch {
        return res.status(500).json({ ok: false, error: "invalid_ESCROW_WALLET" });
      }

      const amountTon = Number((req.body as any)?.amountTon);
      if (!Number.isFinite(amountTon) || amountTon <= 0) {
        return res.status(400).json({ ok: false, error: "invalid_amount" });
      }

      // هل الطلب داخل TMA؟
      const hasTgHeader = typeof req.headers["x-telegram-init-data"] === "string";

      // لو داخل TMA نحاول ربطه بالمستخدم
      const me = hasTgHeader ? await getMe(req) : null;

      // نبني تعليق فريد (يُستخدم للتتبع في السلسلة)
      const code = "D" + crypto.randomBytes(4).toString("hex");

      const amountNano = toNano(amountTon);

      // ✅ ابني الـ payload بالتعليق عبر @ton/core
      const commentCell = beginCell().storeUint(0, 32).storeStringTail(code).endCell();
      const payloadB64 = commentCell.toBoc().toString("base64");

      // صلاحية افتراضية 6 دقائق (المحفظة تقبل ثواني\تايمستامب)
      const txPayload = {
        validUntil: Math.floor(Date.now() / 1000) + 360,
        messages: [
          { address: escrow, amount: amountNano, payload: payloadB64 }
        ],
      } as const;

      // لو عندنا مستخدم (داخل TMA) خزّن العملية في DB حتى نقدر نعمل polling
      if (me?.id) {
        const [p] = await db.insert(payments).values({
          listingId: null,
          buyerId: me.id,
          sellerId: null,
          kind: "deposit",
          locked: false,
          amount: String(amountTon), // خزّن بالـ TON
          currency: "TON",
          feePercent: "0",
          feeAmount: "0",
          sellerAmount: "0",
          escrowAddress: escrow,
          comment: code, // نستخدمه في التحقق
          txHash: null,
          buyerConfirmed: false,
          sellerConfirmed: false,
          status: "waiting",
          adminAction: "none",
        }).returning({ id: payments.id });

        return res.status(201).json({
          ok: true,
          id: String(p.id),
          code,
          escrowAddress: escrow,
          amountTon,
          amountNano,
          txPayload,
        });
      }

      // خارج TMA: رجّع فقط txPayload والكود (بدون إنشاء سجل DB)
      return res.status(200).json({
        ok: true,
        code,
        escrowAddress: escrow,
        amountTon,
        amountNano,
        txPayload,
        note: "no_session" // معلومة للمراجعة إن الطلب تم خارج TMA
      });
    } catch (e: any) {
      console.error("deposit/initiate error:", e);
      return res.status(500).json({ ok: false, error: e?.message || "deposit_initiate_failed" });
    }
  });

  /** 3) Deposit status (بدون tgAuth حتى لا يفشل الاستعلام خارج TMA) */
  app.post("/api/wallet/deposit/status", async (req: Request, res: Response) => {
    // لو خارج TMA غالباً ما عدنا جلسة مستخدم، نرجّع pending
    const hasTgHeader = typeof req.headers["x-telegram-init-data"] === "string";
    const me = hasTgHeader ? await getMe(req) : null;

    const escrow = (process.env.ESCROW_WALLET || "").trim();
    const code = String((req.body as any)?.code || "");
    const minTon = Number((req.body as any)?.minTon || "0");
    if (!escrow || !code) return res.status(400).json({ ok: false, error: "bad_request" });

    // خارج TMA → ما عدنا buyerId نربط عليه
    if (!me?.id) {
      return res.json({ ok: true, status: "pending" });
    }

    // ابحث عن آخر إيداع بنفس الكود للمستخدم
    const waitingRows = await db.select({
      id: payments.id, buyerId: payments.buyerId, kind: payments.kind,
      status: payments.status, comment: payments.comment, createdAt: payments.createdAt,
    })
    .from(payments)
    .where(
      and(
        eq(payments.buyerId, me.id),
        eq(payments.kind, "deposit" as any),
        eq(payments.status, "waiting" as any),
        eq(payments.comment, code)
      )
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);

    const waiting = waitingRows[0];
    if (!waiting) return res.status(404).json({ ok: false, status: "not_found" });

    // تحقّق على السلسلة باستخدام التعليق
    const v = await verifyTonDepositByComment({
      escrow,
      code,
      minAmountTon: Number.isFinite(minTon) && minTon > 0 ? minTon : 0,
    });

    if (!v.ok) return res.json({ ok: true, status: "pending" });

    // ثبّت الوحدات: خزن TON دائماً
    await db.update(payments)
      .set({
        amount: String(v.amountTon), // TON
        txHash: v.txHash ?? null,
        status: "paid",
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, waiting.id), eq(payments.status, "waiting")));

    const [updated] = await db.select({
      id: payments.id, amount: payments.amount, txHash: payments.txHash,
    }).from(payments).where(eq(payments.id, waiting.id)).limit(1);

    await db.insert(walletLedger).values({
      userId: me.id,
      direction: "in",
      amount: String(v.amountTon), // TON
      currency: "TON",
      refType: "deposit",
      refId: updated.id,
      note: "Deposit confirmed",
    });

    return res.json({
      ok: true,
      status: "paid",
      amount: Number(updated.amount),
      txHash: updated.txHash,
      id: String(updated.id),
    });
  });

  /** 4) Balance (داخل TMA) */
  app.get("/api/wallet/balance", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

    const row = await db.select().from(walletBalancesView).where(eq(walletBalancesView.userId, me.id)).limit(1);

    res.json({
      ok: true,
      currency: row[0]?.currency ?? "TON",
      balance: Number(row[0]?.balance ?? 0).toFixed(9),
    });
  });

  /** 5) Ledger (داخل TMA) */
  app.get("/api/wallet/ledger", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

    const rows = await db.select().from(walletLedger).where(eq(walletLedger.userId, me.id)).orderBy(desc(walletLedger.createdAt)).limit(50);

    const safeRows = JSON.parse(JSON.stringify(rows, jsonSafe));
    res.json({ ok: true, rows: safeRows });
  });
}