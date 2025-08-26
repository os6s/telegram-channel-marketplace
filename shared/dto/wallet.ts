// shared/dto/wallet.ts
import { z } from "zod";

/* ===== Common helpers ===== */
const RE_NUMERIC = /^[0-9]+(\.[0-9]+)?$/;

/* ===== Enums ===== */
export const Currency = z.enum(["TON", "USDT"]);

/* ===== Deposit Request ===== */
export const DepositRequestSchema = z.object({
  userId: z.string().uuid(),
  amount: z.string().regex(RE_NUMERIC),
  currency: Currency.default("TON"),
  comment: z.string().optional(),
});
export type DepositRequestDTO = z.infer<typeof DepositRequestSchema>;

/* ===== Withdraw Request ===== */
export const WithdrawRequestSchema = z.object({
  userId: z.string().uuid(),
  amount: z.string().regex(RE_NUMERIC),
  currency: Currency.default("TON"),
  toAddress: z.string().min(20),
  note: z.string().optional(),
});
export type WithdrawRequestDTO = z.infer<typeof WithdrawRequestSchema>;

/* ===== Wallet Balance DTO (from wallet_balances_view) ===== */
export const WalletBalanceSchema = z.object({
  userId: z.string().uuid(),
  telegramId: z.string().nullable().optional(),   // new from view
  username: z.string().nullable().optional(),
  walletAddress: z.string().nullable().optional(), // new from view
  balance: z.string(),                             // keep as string for NUMERIC precision
  currency: Currency,
  txCount: z.union([z.string(), z.number()]).optional(),
  lastTx: z.string().nullable().optional(),
});
export type WalletBalanceDTO = z.infer<typeof WalletBalanceSchema>;

/* ===== Wallet Ledger Entry DTO ===== */
export const WalletLedgerSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  direction: z.enum(["in", "out"]),
  amount: z.string().regex(RE_NUMERIC),
  currency: Currency,
  refType: z.enum([
    "deposit",
    "order_hold",
    "order_release",
    "refund",
    "adjustment",
    "payout_request",  // ✅ added
    "payout_refund",   // ✅ added
  ]),
  refId: z.string().uuid().optional(),
  note: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type WalletLedgerDTO = z.infer<typeof WalletLedgerSchema>;