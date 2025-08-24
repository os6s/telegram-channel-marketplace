// shared/dto/payout.ts
import { z } from "zod";

/* ===== Enums / Helpers ===== */
export const Currency = z.enum(["TON", "USDT"]); // نخليها محصورة مثل باقي DTOs

const RE_NUMERIC = /^[0-9]+(\.[0-9]+)?$/;

/* ===== Create payout request (user side) ===== */
export const PayoutRequestSchema = z.object({
  sellerId: z.string().uuid(),
  toAddress: z.string().min(20), // عنوان TON
  amount: z.string().regex(RE_NUMERIC), // نستخدم نص مثل الـ payments
  currency: Currency.default("TON"),
  note: z.string().optional(),
});

/* ===== Full payout (API response) ===== */
export const PayoutSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid().nullable().optional(),
  sellerId: z.string().uuid(),
  toAddress: z.string(),
  amount: z.string(),
  currency: Currency,
  status: z.enum(["queued", "sent", "confirmed", "failed"]).default("queued"),
  txHash: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  adminChecked: z.boolean().optional(),
  checklist: z.string().nullable().optional(),
  createdAt: z.string(),
  sentAt: z.string().nullable().optional(),
  confirmedAt: z.string().nullable().optional(),
});

/* ===== Types ===== */
export type PayoutRequestDTO = z.infer<typeof PayoutRequestSchema>;
export type PayoutDTO = z.infer<typeof PayoutSchema>;
