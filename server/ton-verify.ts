// server/ton-verify.ts

// ✅ بيئة متناسقة مع باقي المشروع (مع Back-compat)
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
  // toncenter variants: msg_data.text OR base64 in msg_data.body (msg.dataText)
  const md = obj?.msg_data ?? obj?.message?.msg_data;
  if (!md) return "";
  if (typeof md.text === "string") return md.text;
  if (typeof md.body === "string") {
    try {
      const txt = Buffer.from(md.body, "base64").toString("utf8");
      return txt.replace(/\0+$/, ""); // شيل أي null-terminators
    } catch {
      return "";
    }
  }
  return "";
}

/** التحقق من دفع معيّن بالـ txHash ضد عنوان escrow */
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

    // الشكل الشائع في toncenter
    const inMsg = data?.result?.in_msg;
    const amountTon = toTon(inMsg?.value);
    return amountTon >= Number(opts.expected || 0);
  } catch (e) {
    console.error("[verifyTonPayment] failed:", (e as any)?.message || e);
    return false;
  }
}

/**
 * التحقق من إيداع بالاعتماد على التعليق (code) داخل in_msg
 * يبحث في آخر 20 ثم 40 معاملة لعنوان الـ escrow.
 */
export async function verifyTonDepositByComment(opts: {
  escrow: string;
  code: string;
  minAmountTon?: number;
}): Promise<{ ok: boolean; amountTon: number; txHash?: string }> {
  const addr = norm(opts.escrow);
  const code = norm(opts.code);
  if (!addr || !code) return { ok: false, amountTon: 0 };

  const limits = [20, 40];
  for (const limit of limits) {
    try {
      const url = `${TCC_URL}/getTransactions?address=${encodeURIComponent(addr)}&limit=${limit}`;
      const data = await fetchJson<any>(url);
      const txs: any[] = Array.isArray(data?.result) ? data.result : [];

      for (const tx of txs) {
        const inMsg = tx?.in_msg;
        if (!inMsg) continue;

        const comment = norm(decodeComment(inMsg));
        if (comment !== code) continue;

        const amountTon = toTon(inMsg.value);
        if (opts.minAmountTon && amountTon < opts.minAmountTon) continue;

        // حاول استخراج الهاش من عدة أماكن (حسب toncenter)
        const txHash: string | undefined =
          tx?.transaction_id?.hash ||
          tx?.hash ||
          undefined;

        return { ok: true, amountTon, txHash };
      }
    } catch (e) {
      console.error("[verifyTonDepositByComment] fetch failed:", (e as any)?.message || e);
      // نكمل للمحاولة التالية بحد أكبر
    }
  }

  return { ok: false, amountTon: 0 };
}