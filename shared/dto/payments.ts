import { z } from "zod";

const RE_NUM = /^[0-9]+(\.[0-9]+)?$/;

export const PaymentCreateDTO = z.object({
  listingId: z.string().uuid().optional(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  amount: z.string().regex(RE_NUM),
  currency: z.string().default("TON"),
  feePercent: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  comment: z.string().optional(),
  escrowAddress: z.string().optional(),
  txHash: z.string().optional(),
});

export const PaymentDTO = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid().nullable().optional(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  buyerUsername: z.string().nullable().optional(),
  sellerUsername: z.string().nullable().optional(),
  amount: z.string(),
  currency: z.string(),
  status: z.enum(["pending","paid","refunded","cancelled"]),
  adminAction: z.enum(["none","release","refund","freeze"]),
  escrowAddress: z.string(),
  txHash: z.string().nullable().optional(),
  createdAt: z.string(), // ISO
});
export type TPaymentCreate = z.infer<typeof PaymentCreateDTO>;
export type TPayment = z.infer<typeof PaymentDTO>;