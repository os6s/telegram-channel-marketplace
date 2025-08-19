// server/ton-utils.ts
import assert from "node:assert";

/** نماذج استجابات */
type TonApiAccount = { balance?: string | number };
type TonCenterInfo = { ok?: boolean; result?: { balance?: string | number }; balance?: string | number };

const TIMEOUT_MS = 7000;

/** تحويل nanoTON → TON كرقم */
function ntToTON(nanotons: string | number): number {
  const n = typeof nanotons === "string" ? Number(nanotons) : nanotons;
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n) / 1e9;
}

/** fetch مع مهلة */
async function fetchJsonWithTimeout<T = any>(url: string, init?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<T> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(id);
  }
}

/** طلب من TonAPI */
async function getFromTonApi(address: string): Promise<number> {
  const TONAPI_URL = process.env.TONAPI_URL?.replace(/\/+$/, "");
  const TONAPI_KEY = process.env.TONAPI_KEY;
  if (!TONAPI_URL || !TONAPI_KEY) throw new Error("TONAPI config missing");
  const data = await fetchJsonWithTimeout<TonApiAccount>(
    `${TONAPI_URL}/v2/accounts/${encodeURIComponent(address)}`,
    { headers: { Authorization: `Bearer ${TONAPI_KEY}` } }
  );
  const bal = data?.balance;
  return bal == null ? 0 : ntToTON(bal);
}

/** طلب من Toncenter */
async function getFromToncenter(address: string): Promise<number> {
  const TCC_URL = process.env.TONCENTER_API_URL?.replace(/\/+$/, "");
  const TCC_KEY = process.env.TONCENTER_API_KEY;
  if (!TCC_URL || !TCC_KEY) throw new Error("Toncenter config missing");
  const url = `${TCC_URL}/getAddressInformation?address=${encodeURIComponent(address)}&api_key=${encodeURIComponent(TCC_KEY)}`;
  const data = await fetchJsonWithTimeout<TonCenterInfo>(url);
  const bal = data?.result?.balance ?? (data as any)?.balance;
  return bal == null ? 0 : ntToTON(bal);
}

/**
 * يجلب رصيد عنوان TON (TON وليس nano) مع دعم المزودين:
 * - لو الاثنين مضبوطين: نحاول TonAPI أولًا، وإن فشل/تأخر → Toncenter.
 * - لو واحد فقط مضبوط: نستخدمه.
 * - لو ولا واحد: نرمي خطأ واضح.
 */
export async function getTonBalance(address: string): Promise<number> {
  if (!address) throw new Error("Wallet address required");

  const haveTonApi = !!(process.env.TONAPI_URL && process.env.TONAPI_KEY);
  const haveToncenter = !!(process.env.TONCENTER_API_URL && process.env.TONCENTER_API_KEY);

  if (!haveTonApi && !haveToncenter) {
    throw new Error(
      "TON API config missing. Set either (TONAPI_URL & TONAPI_KEY) or (TONCENTER_API_URL & TONCENTER_API_KEY)."
    );
  }

  // الاثنين موجودين → جرّب TonAPI ثم Toncenter كـ fallback
  if (haveTonApi && haveToncenter) {
    try {
      const tonapiBal = await getFromTonApi(address);
      return tonapiBal;
    } catch (e) {
      console.warn("[ton] TonAPI failed, falling back to Toncenter:", (e as Error)?.message);
      return await getFromToncenter(address);
    }
  }

  // واحد فقط
  if (haveTonApi) return await getFromTonApi(address);
  return await getFromToncenter(address);
}

/** يتحقق أنّ المستخدم يملك رصيد ≥ amountTON (TON فقط حاليًا) */
export async function ensureBuyerHasFunds(opts: { userTonAddress?: string | null; amountTON: number }) {
  assert(Number.isFinite(opts.amountTON), "amountTON must be a finite number");
  const addr = (opts.userTonAddress || "").trim();
  if (!addr) throw new Error("Wallet not set");
  const bal = await getTonBalance(addr);
  if (bal + 1e-9 < opts.amountTON) {
    const need = (opts.amountTON - bal).toFixed(4);
    const err: any = new Error(`INSUFFICIENT_FUNDS: need +${need} TON`);
    err.code = "INSUFFICIENT_FUNDS";
    err.details = { balance: bal, required: opts.amountTON };
    throw err;
  }
  return true;
}