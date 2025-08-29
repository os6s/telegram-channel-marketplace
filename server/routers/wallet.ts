// server/routes/wallet.ts
import { Router, Request, Response } from "express";
import { beginCell } from "@ton/core";
import crypto from "node:crypto";
import { db } from "../db.js";
import { users, walletLedger } from "@shared/schema";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

/* ====== ENV ====== */
const ESCROW_ADDRESS = String(process.env.ESCROW_ADDRESS || "").trim();
const TONCENTER_ENDPOINT = String(
  process.env.TONCENTER_ENDPOINT || "https://toncenter.com/api/v2"
).replace(/\/+$/, "");
const TONCENTER_API_KEY = String(process.env.TONCENTER_API_KEY || "").trim();

if (!ESCROW_ADDRESS) console.warn("[wallet] ESCROW_ADDRESS not set");

/* ====== helpers ====== */
function toNanoStr(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount invalid");
  const [i, f = ""] = String(amount).split(".");
  const f9 = (f + "000000000").slice(0, 9);
  const s = `${i.replace(/^0+/, "")}${f9}`.replace(/^0+/, "");
  return s.length ? s : "0";
}
function buildCommentPayload(text: string): string {
  const cell = beginCell().storeUint(0, 32).storeStringTail(text).endCell();
  return cell.toBoc().toString("base64");
}
function randomHex(len: number): string {
  return crypto.randomBytes(len).toString("hex").slice(0, len);
}

function getTelegram(req: Request) {
  return (req as any).telegramUser as { id: number; username?: string } | undefined;
}
async function getUserByTelegramId(tgId: number) {
  return db.query.users.findFirst({ where: eq(users.telegramId, BigInt(tgId)) });
}

/* ====== /api/wallet/deposit ====== */
router.post("/deposit", async (req: Request, res: Response) => {
  try {
    const { amount } = req.body as { amount?: number };
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ ok: false, error: "amount > 0 required" });
    }
    if (!ESCROW_ADDRESS) {
      return res.status(500).json({ ok: false, error: "escrow_misconfigured" });
    }

    const tg = getTelegram(req);
    if (!tg?.id) return res.status(401).json({ ok: false, error: "unauthorized" });
    const u = await getUserByTelegramId(tg.id);
    if (!u?.id) return res.status(404).json({ ok: false, error: "user_not_found" });

    // ✅ ولّد كومنت قصير عشوائي مثل ca3e98a2b7
    const comment = randomHex(10);

    const tonConnectTx = {
      validUntil: Math.floor(Date.now() / 1000) + 900,
      messages: [
        {
          address: ESCROW_ADDRESS,
          amount: toNanoStr(amount),
          payload: buildCommentPayload(comment),
        },
      ],
    };

    // ⚠️ احفظ الكومنت بالـ note (اختياري pending)
    await db.insert(walletLedger).values({
      userId: u.id,
      direction: "in",
      amount: "0", // لحد الآن ما وصل
      currency: "TON",
      refType: "deposit",
      refId: null,
      note: comment,
    });

    return res.json({
      ok: true,
      deposit: { asset: "TON", amount, comment, tonConnectTx },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/* ====== /api/wallet/deposit/status ======
   يتحقق من Toncenter و يحدث الرصيد لمرة واحدة */
router.post("/deposit/status", async (req: Request, res: Response) => {
  try {
    const { comment } = req.body as { comment?: string };
    if (!comment) return res.status(400).json({ ok: false, error: "comment_required" });

    if (!ESCROW_ADDRESS) {
      return res.status(500).json({ ok: false, error: "escrow_misconfigured" });
    }

    // استعلام Toncenter عن آخر 20 معاملة
    const url = `${TONCENTER_ENDPOINT}/getTransactions?address=${encodeURIComponent(
      ESCROW_ADDRESS
    )}&limit=20`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (TONCENTER_API_KEY) headers["X-API-Key"] = TONCENTER_API_KEY;

    const r = await fetch(url, { headers });
    const j = await r.json().catch(() => ({} as any));
    const txs: any[] = j?.result || [];

    for (const tx of txs) {
      const hash: string | undefined = tx?.transaction_id?.hash;
      const txt = tx?.in_msg?.msg_data?.text;
      const value = tx?.in_msg?.value;

      if (txt === comment) {
        // تحقق إذا سجلناها قبل
        const exists = await db
          .select({ id: walletLedger.id })
          .from(walletLedger)
          .where(and(eq(walletLedger.note, comment), eq(walletLedger.refType, "deposit")))
          .limit(1);
        if (exists.length > 0 && Number(exists[0].id)) {
          return res.json({ ok: true, status: "paid", txHash: hash });
        }

        // احسب القيمة بالـ TON
        const tonAmount = (Number(value) / 1e9).toString();

        // حدّث القيد pending
        await db
          .update(walletLedger)
          .set({ amount: tonAmount, note: hash })
          .where(and(eq(walletLedger.note, comment), eq(walletLedger.refType, "deposit")));

        return res.json({ ok: true, status: "paid", txHash: hash, amount: tonAmount });
      }
    }

    return res.json({ ok: true, status: "pending" });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/* ====== /api/wallet/address ====== */
router.get("/address", async (req: Request, res: Response) => {
  try {
    const tg = getTelegram(req);
    if (!tg?.id) return res.json({ walletAddress: null });
    const u = await getUserByTelegramId(tg.id);
    return res.json({ walletAddress: (u as any)?.walletAddress ?? null });
  } catch (e: any) {
    return res.status(500).json({ walletAddress: null, error: String(e?.message || e) });
  }
});
router.post("/address", async (req: Request, res: Response) => {
  try {
    const tg = getTelegram(req);
    if (!tg?.id) return res.status(401).json({ ok: false, error: "unauthorized" });
    const addr = String((req.body as any)?.walletAddress || "").trim();
    if (!addr || addr.length < 20)
      return res.status(400).json({ ok: false, error: "invalid address" });
    const u = await getUserByTelegramId(tg.id);
    if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });
    await db.update(users).set({ walletAddress: addr } as any).where(eq(users.id, u.id));
    return res.json({ ok: true, walletAddress: addr });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
router.delete("/address", async (req: Request, res: Response) => {
  try {
    const tg = getTelegram(req);
    if (!tg?.id) return res.status(401).json({ ok: false, error: "unauthorized" });
    const u = await getUserByTelegramId(tg.id);
    if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });
    await db.update(users).set({ walletAddress: null } as any).where(eq(users.id, u.id));
    return res.json({ ok: true, walletAddress: null });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/* ====== /api/wallet/balance ====== */
router.get("/balance", async (req: Request, res: Response) => {
  try {
    const tg = getTelegram(req);
    if (!tg?.id) return res.json({ balance: "0", currency: "TON" });
    try {
      const u = await getUserByTelegramId(tg.id);
      if (!u) return res.json({ balance: "0", currency: "TON" });
      const rows = await db
        .select({
          inSum: sql<string>`COALESCE(SUM(CASE WHEN ${walletLedger.direction} = 'in' THEN ${walletLedger.amount} ELSE 0 END), 0)::text`,
          outSum: sql<string>`COALESCE(SUM(CASE WHEN ${walletLedger.direction} = 'out' THEN ${walletLedger.amount} ELSE 0 END), 0)::text`,
        })
        .from(walletLedger)
        .where(eq(walletLedger.userId, u.id));
      const inSum = Number(rows?.[0]?.inSum || 0);
      const outSum = Number(rows?.[0]?.outSum || 0);
      const bal = Math.max(inSum - outSum, 0);
      return res.json({ balance: String(bal), currency: "TON" });
    } catch {
      return res.json({ balance: "0", currency: "TON" });
    }
  } catch (e: any) {
    return res.status(500).json({ balance: "0", currency: "TON", error: String(e?.message || e) });
  }
});

export default router;