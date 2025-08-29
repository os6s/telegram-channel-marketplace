// server/routes/wallet.ts
import { Router, Request, Response } from "express";
import { beginCell } from "ton-core";
import { db } from "../db.js";
import { users, walletLedger } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";

const router = Router();

// ===== إعدادات الإيداع عبر TonConnect =====
const ESCROW_ADDRESS = "UQAdnKLl4-hXE_oDoqTwD22aA3ou884lqEQrTzazKI3zxIhf";
const COMMENT_TEXT = "ton/ton!!!";

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

// ===== Helpers =====
function getTelegram(req: Request) {
  return (req as any).telegramUser as { id: number; username?: string } | undefined;
}
async function getUserByTelegramId(tgId: number) {
  return db.query.users.findFirst({ where: eq(users.telegramId, tgId) });
}

// ===== /api/wallet/deposit (TonConnect فقط) =====
router.post("/deposit", (req: Request, res: Response) => {
  try {
    const { amount } = req.body as { amount?: number };
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ ok: false, error: "amount > 0 required" });
    }
    const tonConnectTx = {
      validUntil: Math.floor(Date.now() / 1000) + 900, // 15 دقيقة
      messages: [
        {
          address: ESCROW_ADDRESS,
          amount: toNanoStr(amount),
          payload: buildCommentPayload(COMMENT_TEXT),
        },
      ],
    };
    return res.json({ ok: true, deposit: { asset: "TON", amount, tonConnectTx } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ===== /api/wallet/address =====
// GET: يرجّع العنوان المرتبط بالمستخدم الحالي
router.get("/address", async (req: Request, res: Response) => {
  try {
    const tg = getTelegram(req);
    if (!tg?.id) return res.json({ walletAddress: null });
    const u = await getUserByTelegramId(tg.id);
    // ملاحظة: حدّث اسم العمود حسب schema لديك
    return res.json({ walletAddress: (u as any)?.walletAddress ?? null });
  } catch (e: any) {
    return res.status(500).json({ walletAddress: null, error: String(e?.message || e) });
  }
});

// POST: يربط عنوان المحفظة للمستخدم الحالي
router.post("/address", async (req: Request, res: Response) => {
  try {
    const tg = getTelegram(req);
    if (!tg?.id) return res.status(401).json({ ok: false, error: "unauthorized" });

    const addr = String((req.body as any)?.walletAddress || "").trim();
    if (!addr || addr.length < 20) return res.status(400).json({ ok: false, error: "invalid address" });

    const u = await getUserByTelegramId(tg.id);
    if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });

    await db
      .update(users)
      .set({ walletAddress: addr } as any)
      .where(eq(users.id, u.id));

    return res.json({ ok: true, walletAddress: addr });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// DELETE: يفصل العنوان المرتبط
router.delete("/address", async (req: Request, res: Response) => {
  try {
    const tg = getTelegram(req);
    if (!tg?.id) return res.status(401).json({ ok: false, error: "unauthorized" });

    const u = await getUserByTelegramId(tg.id);
    if (!u) return res.status(404).json({ ok: false, error: "user_not_found" });

    await db
      .update(users)
      .set({ walletAddress: null } as any)
      .where(eq(users.id, u.id));

    return res.json({ ok: true, walletAddress: null });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ===== /api/wallet/balance =====
// يرجّع الرصيد بصيغة { balance, currency }. إن لم يوجد Ledger يرجّع 0 TON.
router.get("/balance", async (req: Request, res: Response) => {
  try {
    const tg = getTelegram(req);
    if (!tg?.id) return res.json({ balance: "0", currency: "TON" });

    // إن كان لديك جدول ledger: اجمع IN - OUT
    try {
      const rows = await db
        .select({
          inSum: sql<string>`COALESCE(SUM(CASE WHEN ${walletLedger.direction} = 'in' THEN ${walletLedger.amount} ELSE 0 END), 0)::text`,
          outSum: sql<string>`COALESCE(SUM(CASE WHEN ${walletLedger.direction} = 'out' THEN ${walletLedger.amount} ELSE 0 END), 0)::text`,
        })
        .from(walletLedger)
        .where(eq(walletLedger.userId, (await getUserByTelegramId(tg.id))!.id));

      const inSum = Number(rows?.[0]?.inSum || 0);
      const outSum = Number(rows?.[0]?.outSum || 0);
      const bal = Math.max(inSum - outSum, 0);
      return res.json({ balance: String(bal), currency: "TON" });
    } catch {
      // بدون Ledger
      return res.json({ balance: "0", currency: "TON" });
    }
  } catch (e: any) {
    return res.status(500).json({ balance: "0", currency: "TON", error: String(e?.message || e) });
  }
});

export default router;