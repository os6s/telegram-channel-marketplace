// server/ton-verify.ts
import { Cell } from "@ton/core";

// ✅ Toncenter API base + key
const TCC_URL =
  (process.env.TONCENTER_API_URL || process.env.TON_API_BASE || "https://toncenter.com/api/v2")
    .replace(/\/+$/, "");
const TCC_KEY = process.env.TONCENTER_API_KEY || process.env.TON_API_KEY || "";

type FetchJson = <T = any>(url: string, opts?: { timeoutMs?: number }) => Promise<T>;

const fetchJson: FetchJson = async (url, { timeoutMs = 8000 } = {}) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(TCC_KEY ? { "X-API-Key": TCC_KEY } : {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return (await res.json()) as any;
  } finally {
    clearTimeout(t);
  }
};

function toTon(nano: unknown): number {
  const v = Number(nano ?? 0);
  return Number.isFinite(v) ? v / 1e9 : 0;
}
function norm(s: unknown) {
  return String(s ?? "").trim();
}

/** ✅ فكّ تعليق BOC: op=0 ثم string tail */
function decodeComment(obj: any): string {
  // toncenter: قد تكون تحت in_msg.msg_data أو transaction.message.msg_data
  const md = obj?.msg_data ?? obj?.message?.msg_data;
  if (!md) return "";

  // نص صريح إن وُجد
  if (typeof md.text === "string") return md.text;

  // BOC Base64 في body
  const b64 = typeof md.body === "string" ? md.body : undefined;
  if (!b64) return "";

  try {
    const boc = Buffer.from(b64, "base64");
    const cells = Cell.fromBoc(boc);
    if (!cells.length) return "";
    const slice = cells[0].beginParse();
    // op
    const op = slice.loadUint(32).toNumber();
    if (op !== 0) return ""; // نتعامل فقط مع op=0 للتعليقات
    const text = slice.loadStringTail();
    return text.replace(/\0+$/, "");
  } catch {
    return "";
  }
}

function normalizeComment(s: string): string {
  return s.replace(/\0+$/, "").trim().toLowerCase();
}

/** تحقق من دفع معيّن بالـ txHash ضد عنوان escrow */
export async function verifyTonPayment(opts: {
  escrow: string;
  expected: number;
  txHash?: string;
  currency: "TON";
}): Promise<boolean> {
  if (!opts.txHash) return false;
  const addr = norm(opts.escrow);
  const hash = norm(opts.txHash);
  if (!addr || !hash) return false;

  try {
    const url = `${TCC_URL}/getTransaction?hash=${encodeURIComponent(hash)}&address=${encodeURIComponent(addr)}`;
    const data = await fetchJson<any>(url);

    const inMsg = data?.result?.in_msg;
    const amountTon = toTon(inMsg?.value);
    return amountTon >= Number(opts.expected || 0);
  } catch (e) {
    console.error("[verifyTonPayment] failed:", (e as any)?.message || e);
    return false;
  }
}

/**
 * تحقق من إيداع عبر الكود (comment) داخل in_msg
 * يدعم BOC، تطبيع التعليق، وصفحات متعددة.
 */
export async function verifyTonDepositByComment(opts: {
  escrow: string;
  code: string;
  minAmountTon?: number;
}): Promise<{ ok: boolean; amountTon: number; txHash?: string }> {
  const addr = norm(opts.escrow);
  const code = normalizeComment(norm(opts.code));
  if (!addr || !code) return { ok: false, amountTon: 0 };

  const MAX_TXS = 200; // عمق التاريخ
  let fetched = 0;
  let lt: string | undefined;

  while (fetched < MAX_TXS) {
    try {
      const url = new URL(`${TCC_URL}/getTransactions`);
      url.searchParams.set("address", addr);
      url.searchParams.set("limit", "20");
      url.searchParams.set("archival", "true"); // ✅ يسمح بالتصفح الأعمق
      if (lt) url.searchParams.set("lt", lt);

      const data = await fetchJson<any>(url.toString());
      const txs: any[] = Array.isArray(data?.result) ? data.result : [];
      if (!txs.length) break;

      for (const tx of txs) {
        const inMsg = tx?.in_msg;
        if (!inMsg) continue;

        const comment = normalizeComment(decodeComment(inMsg));
        if (comment !== code) continue;

        const amountTon = toTon(inMsg.value);
        if (opts.minAmountTon && amountTon < opts.minAmountTon) continue;

        const txHash: string | undefined =
          tx?.transaction_id?.hash || tx?.hash || undefined;

        return { ok: true, amountTon, txHash };
      }

      fetched += txs.length;
      lt = txs[txs.length - 1]?.transaction_id?.lt;
      if (!lt) break;
    } catch (e) {
      console.error("[verifyTonDepositByComment] fetch failed:", (e as any)?.message || e);
      break;
    }
  }

  return { ok: false, amountTon: 0 };
}