// server/ton-verify.ts

const TON_API_BASE = process.env.TON_API_BASE || "https://toncenter.com/api/v2";
const TON_API_KEY = process.env.TON_API_KEY || "";

type FetchJson = <T=any>(url: string, opts?: { timeoutMs?: number }) => Promise<T>;

const fetchJson: FetchJson = async (url, { timeoutMs = 8000 } = {}) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        ...(TON_API_KEY ? { "X-API-Key": TON_API_KEY } : {}),
        "Accept": "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
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
  // toncenter variants: msg_data.text OR base64 in msg_data.body with "@type":"msg.dataText"
  const md = obj?.msg_data ?? obj?.message?.msg_data;
  if (!md) return "";
  if (typeof md.text === "string") return md.text;
  if (typeof md.body === "string") {
    try {
      const txt = Buffer.from(md.body, "base64").toString("utf8");
      return txt;
    } catch {}
  }
  return "";
}

/** التحقق من دفع معيّن بالـ txHash */
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
    const url = `${TON_API_BASE}/getTransaction?hash=${encodeURIComponent(hash)}&address=${encodeURIComponent(addr)}`;
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
 * التحقق من إيداع بالاعتماد على تعليق comment (كود الإيداع).
 * يبحث في آخر 20–40 معاملة لعنوان الـ escrow.
 */
export async function verifyTonDepositByComment(opts: {
  escrow: string;
  code: string;
  minAmountTon?: number;
}): Promise<{ ok: boolean; amountTon: number; txHash?: string }> {
  const addr = norm(opts.escrow);
  const code = norm(opts.code);
  if (!addr || !code) return { ok: false, amountTon: 0 };

  // حاول على دفعتين لزيادة التغطية بدون إسراف
  const limits = [20, 40];
  for (const limit of limits) {
    try {
      const url = `${TON_API_BASE}/getTransactions?address=${encodeURIComponent(addr)}&limit=${limit}`;
      const data = await fetchJson<any>(url);
      const txs: any[] = Array.isArray(data?.result) ? data.result : [];

      for (const tx of txs) {
        const inMsg = tx?.in_msg;
        if (!inMsg) continue;

        const comment = decodeComment(inMsg);
        if (norm(comment) !== code) continue;

        const amountTon = toTon(inMsg.value);
        if (opts.minAmountTon && amountTon < opts.minAmountTon) continue;

        const txHash: string | undefined =
          tx?.transaction_id?.hash || tx?.transaction_id?.lt ? tx?.transaction_id?.hash : undefined;

        return { ok: true, amountTon, txHash };
      }
    } catch (e) {
      console.error("[verifyTonDepositByComment] fetch failed:", (e as any)?.message || e);
      // جرّب الدفعة التالية (limit الأكبر) أو أعد false
    }
  }

  return { ok: false, amountTon: 0 };
}