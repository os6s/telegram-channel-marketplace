// shared/dto/wallet.ts
import { z } from "zod";

/* ===== Common helpers ===== */
const RE_NUMERIC = /^[0-9]+(\.[0-9]+)?$/;

/* ===== Enums ===== */
export const Currency = z.enum(["TON", "USDT"]);

/* ===== Deposit Request (إيداع) ===== */
export const DepositRequestSchema = z.object({
  userId: z.string().uuid(),                 // المستخدم صاحب العملية
  amount: z.string().regex(RE_NUMERIC),      // قيمة الإيداع كنص
  currency: Currency.default("TON"),         // العملة (افتراضياً TON)
  comment: z.string().optional(),            // ملاحظة / مرجع للتحويل
});
export type DepositRequestDTO = z.infer<typeof DepositRequestSchema>;

/* ===== Withdraw Request (سحب) ===== */
/* ملاحظة: السحب يُعالج عادة عبر payouts؛ هذا DTO لطلب السحب فقط */
export const WithdrawRequestSchema = z.object({
  userId: z.string().uuid(),
  amount: z.string().regex(RE_NUMERIC),
  currency: Currency.default("TON"),
  toAddress: z.string().min(20),             // عنوان المحفظة الخارجية
  note: z.string().optional(),               // ملاحظة اختيارية
});
export type WithdrawRequestDTO = z.infer<typeof WithdrawRequestSchema>;

/* ===== Wallet Balance DTO (كما في الفيو wallet_balances) ===== */
export const WalletBalanceSchema = z.object({
  userId: z.string().uuid(),
  username: z.string().nullable().optional(),
  balance: z.string(),                       // NUMERIC كنص
  currency: Currency,
  txCount: z.union([z.string(), z.number()]).optional(),
  lastTx: z.string().nullable().optional(),  // ISO أو null
});
export type WalletBalanceDTO = z.infer<typeof WalletBalanceSchema>;

/* ===== Wallet Ledger Entry DTO ===== */
export const WalletLedgerSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  direction: z.enum(["in", "out"]),          // in = زيادة, out = نقصان
  amount: z.string().regex(RE_NUMERIC),
  currency: Currency,
  // مطابق لـ walletRefEnum في السكيمة: deposit | order_hold | order_release | refund | adjustment
  refType: z.enum(["deposit", "order_hold", "order_release", "refund", "adjustment"]),
  refId: z.string().uuid().optional(),
  note: z.string().nullable().optional(),
  createdAt: z.string(),                     // ISO string
});
export type WalletLedgerDTO = z.infer<typeof WalletLedgerSchema>;