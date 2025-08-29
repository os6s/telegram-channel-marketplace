// server/routes/wallet.ts
import { Router, Request, Response } from "express";
import { beginCell, Address } from "@ton/core";
import crypto from "node:crypto";
import { db } from "../db.js";
import { users, walletLedger } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

/* ====== ENV ====== */
const ESCROW_ADDRESS = String(process.env.ESCROW_ADDRESS || "").trim();
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

    // ✅ ولّد كومنت قصير عشوائي
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

    return res.json({
      ok: true,
      deposit: { asset: "TON", amount, comment, tonConnectTx },
    });
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
    // ✅ رجّع العنوان كما انخزن (UQ أو EQ)
    return res.json({ walletAddress: u?.walletAddress ?? null });
  } catch (e: any) {
    return res.status(500).json({ walletAddress: null, error: String(e?.message || e) });
  }
});

router.post("/address", async (req: Request, res: Response) => {
  try {
    const tg = getTelegram(req);
    if (!tg?.id) return res.status(401).json({ ok: false, error: "unauthorized" });

    const addr = String((req.body as any)?.walletAddress || "").trim();
    if (!addr) return res.status(400).json({ ok: false, error: "invalid address" });

    // ✅ تحقق فقط، بدون تحويل (UQ أو EQ)
    try {
      Address.parse(addr);
    } catch {
      return res.status(400).json({ ok: false, error: "invalid_address" });
    }

    const u = await getUserByTelegramId(tg.id);
    if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });

    await db.update(users).set({ walletAddress: addr }).where(eq(users.id, u.id));
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

    await db.update(users).set({ walletAddress: null }).where(eq(users.id, u.id));
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