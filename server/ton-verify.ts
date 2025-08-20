// server/ton-verify.ts
import fetch from "node-fetch";

const TON_API_BASE = process.env.TON_API_BASE || "https://toncenter.com/api/v2";
const TON_API_KEY = process.env.TON_API_KEY || "";

/**
 * التحقق من دفع معيّن بالـ txHash
 */
export async function verifyTonPayment(opts: {
  escrow: string;
  expected: number;
  txHash?: string;
  currency: "TON";
}): Promise<boolean> {
  if (!opts.txHash) return false;
  const url = `${TON_API_BASE}/getTransaction?hash=${opts.txHash}&address=${opts.escrow}`;
  const r = await fetch(url, {
    headers: TON_API_KEY ? { "X-API-Key": TON_API_KEY } : {},
  });
  if (!r.ok) {
    console.error("verifyTonPayment fetch failed", await r.text());
    return false;
  }
  const data = await r.json();
  // تحقق من المبلغ
  const amountNano = Number(data?.result?.in_msg?.value || 0);
  const amountTon = amountNano / 1e9;
  return amountTon >= opts.expected;
}

/**
 * التحقق من إيداع بالاعتماد على تعليق comment (كود الإيداع).
 * يبحث في آخر 20 معاملة لعنوان الـ escrow.
 */
export async function verifyTonDepositByComment(opts: {
  escrow: string;
  code: string;
  minAmountTon?: number;
}): Promise<{ ok: boolean; amountTon: number; txHash?: string }> {
  const url = `${TON_API_BASE}/getTransactions?address=${opts.escrow}&limit=20`;
  const r = await fetch(url, {
    headers: TON_API_KEY ? { "X-API-Key": TON_API_KEY } : {},
  });
  if (!r.ok) {
    console.error("verifyTonDepositByComment fetch failed", await r.text());
    return { ok: false, amountTon: 0 };
  }
  const data = await r.json();
  const txs: any[] = data?.result || [];

  for (const tx of txs) {
    const inMsg = tx.in_msg;
    if (!inMsg) continue;
    const comment = inMsg.msg_data?.text || "";
    if (comment.trim() === opts.code.trim()) {
      const amountNano = Number(inMsg.value || 0);
      const amountTon = amountNano / 1e9;
      if (opts.minAmountTon && amountTon < opts.minAmountTon) continue;
      return { ok: true, amountTon, txHash: tx.transaction_id?.hash };
    }
  }

  return { ok: false, amountTon: 0 };
}