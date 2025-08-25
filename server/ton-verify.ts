// server/ton-verify.ts

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

function decodeComment(obj: any): string {
  // toncenter variants: msg_data.text OR base64 in msg_data.body
  const md = obj?.msg_data ?? obj?.message?.msg_data;
  if (!md) return "";
  if (typeof md.text === "string") return md.text;
  if (typeof md.body === "string") {
    try {
      const txt = Buffer.from(md.body, "base64").toString("utf8");
      return txt.replace(/\0+$/, "");
    } catch {
      return "";
    }
  }
  return "";
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
 * الآن يدعم: تطبيع التعليق + صفحات متعددة (حتى 200 معاملة).
 */
export async function verifyTonDepositByComment(opts: {
  escrow: string;
  code: string;
  minAmountTon?: number;
}): Promise<{ ok: boolean; amountTon: number; txHash?: string }> {
  const addr = norm(opts.escrow);
  const code = normalizeComment(norm(opts.code));
  if (!addr || !code) return { ok: false, amountTon: 0 };

  const MAX_TXS = 200; // history depth
  let fetched = 0;
  let lt: string | undefined;

  while (fetched < MAX_TXS) {
    try {
      const url = new URL(`${TCC_URL}/getTransactions`);
      url.searchParams.set("address", addr);
      url.searchParams.set("limit", "20");
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
          tx?.transaction_id?.hash ||
          tx?.hash ||
          undefined;

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
