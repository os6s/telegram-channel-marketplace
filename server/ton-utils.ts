// server/ton-utils.ts
import assert from "node:assert";

type TonApiAccount = { balance: string };
type TonCenterInfo = { ok: boolean; result?: { balance?: string }; balance?: string };

function ntToTON(nanotons: string | number): number {
  const n = typeof nanotons === "string" ? Number(nanotons) : nanotons;
  return Math.floor(n) / 1e9;
}

/** يجيب رصيد عنوان TON كـ رقم بالـ TON (مو nano) */
export async function getTonBalance(address: string): Promise<number> {
  if (!address) throw new Error("Wallet address required");

  // 1) TonAPI (يفضَّل لو متوفر)
  const TONAPI_URL = process.env.TONAPI_URL;
  const TONAPI_KEY = process.env.TONAPI_KEY;

  if (TONAPI_URL && TONAPI_KEY) {
    const r = await fetch(`${TONAPI_URL.replace(/\/+$/,"")}/v2/accounts/${address}`, {
      headers: { Authorization: `Bearer ${TONAPI_KEY}` },
    });
    if (!r.ok) throw new Error(`TonAPI error: ${r.status}`);
    const data = (await r.json()) as TonApiAccount;
    if (!data?.balance) return 0;
    return ntToTON(data.balance);
  }

  // 2) Toncenter (بديل)
  const TCC_URL = process.env.TONCENTER_API_URL;
  const TCC_KEY = process.env.TONCENTER_API_KEY;

  if (TCC_URL && TCC_KEY) {
    const url = `${TCC_URL.replace(/\/+$/,"")}/getAddressInformation?address=${encodeURIComponent(address)}&api_key=${encodeURIComponent(TCC_KEY)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Toncenter error: ${r.status}`);
    const data = (await r.json()) as TonCenterInfo;
    const bal = data?.result?.balance ?? (data as any)?.balance;
    if (!bal) return 0;
    return ntToTON(bal);
  }

  throw new Error(
    "TON API config missing. Set either (TONAPI_URL & TONAPI_KEY) or (TONCENTER_API_URL & TONCENTER_API_KEY)."
  );
}

/** يتأكد أن المستخدم عنده رصيد ≥ المبلغ المطلوب (TON فقط حالياً) */
export async function ensureBuyerHasFunds(opts: { userTonAddress?: string | null; amountTON: number }) {
  assert(Number.isFinite(opts.amountTON), "amountTON must be a finite number");
  const addr = (opts.userTonAddress || "").trim();
  if (!addr) throw new Error("Wallet not set");
  const bal = await getTonBalance(addr);
  if (bal + 1e-9 < opts.amountTON) { // هامش دقة صغير
    const need = (opts.amountTON - bal).toFixed(4);
    const msg = `INSUFFICIENT_FUNDS: need +${need} TON`;
    const err: any = new Error(msg);
    err.code = "INSUFFICIENT_FUNDS";
    err.details = { balance: bal, required: opts.amountTON };
    throw err;
  }
  return true;
}