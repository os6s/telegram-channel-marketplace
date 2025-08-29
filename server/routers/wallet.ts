// server/routes/wallet.ts
import { Router, Request, Response } from "express";
import { beginCell, Address } from "@ton/core";
import crypto from "node:crypto";
import { db } from "../db.js";
import { users, walletLedger } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

/* ====== ENV ====== */
const ESCROW_ADDRESS = String(process.env.ESCROW_WALLET || "").trim();
const TON_API_BASE = String(process.env.TON_API_BASE || "").replace(/\/+$/, "");
const TON_API_KEY = String(process.env.TON_API_KEY || "").trim();
if (!ESCROW_ADDRESS) console.error("[wallet] ESCROW_WALLET not set");
if (!TON_API_BASE) console.error("[wallet] TON_API_BASE not set");
if (!TON_API_KEY) console.error("[wallet] TON_API_KEY not set");

/* ====== Helpers ====== */
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

/* ====== /api/wallet/deposit ======
   يرجّع tx مع تعليق فريد؛ لا يكتب في ledger الآن. */
router.post("/deposit", async (req: Request, res: Response) => {
  try {
    const { amount } = req.body as { amount?: number };
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ ok: false, error: "amount > 0 required" });
    }
    if (!ESCROW_ADDRESS) return res.status(500).json({ ok: false, error: "escrow_misconfigured" });

    const tg = getTelegram(req);
    if (!tg?.id) return res.status(401).json({ ok: false, error: "unauthorized" });
    const u = await getUserByTelegramId(tg.id);
    if (!u?.id) return res.status(404).json({ ok: false, error: "user_not_found" });

    const comment = randomHex(10); // مثل ca3e98a2b7
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

    return res.json({ ok: true, deposit: { asset: "TON", amount, comment, tonConnectTx } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/* ====== Toncenter: fetch last transactions for escrow ====== */
async function fetchEscrowTxs(limit = 40) {
  const url = new URL(`${TON_API_BASE}/getTransactions`);
  url.searchParams.set("address", ESCROW_ADDRESS);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("archival", "false");
  url.searchParams.set("api_key", TON_API_KEY);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`toncenter_http_${r.status}`);
  return (await r.json()) as any;
}

/* حاول مطابقة التعليق سواء كنص أو كـ base64 payload */
function messageHasComment(msg: any, wanted: string, wantedBocBase64: string): boolean {
  try {
    // بعض استجابات toncenter تُعيد نص التعليق هنا
    const text = msg?.msg_data?.text || msg?.message || msg?.comment;
    if (typeof text === "string" && text.trim() === wanted) return true;
    // أو body/base64
    const body = msg?.msg_data?.body || msg?.body || msg?.b64 || "";
    if (typeof body === "string" && body === wantedBocBase64) return true;
  } catch {}
  return false;
}

/* ====== /api/wallet/deposit/status ======
   يدخل: { comment, minTon? } ويؤكد الإيداع ويكتب ledger عند التطابق. */
router.post("/deposit/status", async (req: Request, res: Response) => {
  try {
    const { comment, minTon } = (req.body || {}) as { comment?: string; minTon?: number };
    if (!comment || typeof comment !== "string" || comment.length < 4) {
      return res.status(400).json({ ok: false, error: "bad_comment" });
    }
    if (!ESCROW_ADDRESS || !TON_API_BASE || !TON_API_KEY) {
      return res.status(500).json({ ok: false, error: "toncenter_misconfigured" });
    }

    const tg = getTelegram(req);
    if (!tg?.id) return res.status(401).json({ ok: false, error: "unauthorized" });
    const u = await getUserByTelegramId(tg.id);
    if (!u?.id) return res.status(404).json({ ok: false, error: "user_not_found" });

    const wantedPayload = buildCommentPayload(comment);
    const data = await fetchEscrowTxs(40);

    const txs: any[] = Array.isArray(data?.result) ? data.result : [];
    let match: { txHash: string; amountTon: number } | null = null;

    // ابحث في المعاملة والرسائل الداخلية
    for (const tx of txs) {
      const inMsg = tx?.in_msg;
      const outMsgs = Array.isArray(tx?.out_msgs) ? tx.out_msgs : [];
      const candidates = [inMsg, ...outMsgs].filter(Boolean);

      for (const m of candidates) {
        if (messageHasComment(m, comment, wantedPayload)) {
          const valueNanoStr =
            m?.value ??
            m?.amount ??
            m?.value_atomic ??
            m?.info?.value ??
            "0";
          const valueNano = BigInt(String(valueNanoStr));
          const amountTon = Number(valueNano) / 1e9;
          const txHash = tx?.transaction_id?.hash || tx?.hash || crypto.randomUUID();

          match = { txHash, amountTon };
          break;
        }
      }
      if (match) break;
    }

    if (!match) {
      return res.json({ status: "pending" });
    }

    // تحقق حدّ أدنى اختياري
    if (typeof minTon === "number" && match.amountTon + 1e-9 < minTon) {
      // أقل من المطلوب → اعتبرها pending حتى لا تُرصّد
      return res.json({ status: "pending" });
    }

    // اكتب ledger إن لم يكن مكتوب سابقًا لنفس (user, ref_type=deposit, note يبدأ بالتعليق)
    const exists = await db
      .select({ id: walletLedger.id })
      .from(walletLedger)
      .where(
        eq(walletLedger.userId, u.id)
      )
      .limit(100);

    const already = exists.some((r: any) => r?.note?.startsWith?.(comment));
    if (!already) {
      await db.insert(walletLedger).values({
        userId: u.id,
        direction: "in",
        amount: String(match.amountTon),
        currency: "TON",
        refType: "deposit",
        refId: crypto.randomUUID(),
        note: `${comment}|${match.txHash}`,
      });
    }

    return res.json({ status: "paid", txHash: match.txHash, amountTon: match.amountTon });
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

    try { Address.parse(addr); } catch { return res.status(400).json({ ok: false, error: "invalid_address" }); }

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