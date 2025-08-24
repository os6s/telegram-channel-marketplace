import { z } from "zod";

export const ActivityType = z.enum([
  "buy",
  "buyer_confirm",
  "seller_confirm",
  "admin_release",
  "admin_refund",
]);

export const ActivityStatus = z.enum(["pending", "completed", "cancelled"]);

export const ActivityDTO = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid().nullable(),
  buyerId: z.string().uuid().nullable(),
  sellerId: z.string().uuid().nullable(),
  paymentId: z.string().uuid().nullable(),
  type: ActivityType,
  status: ActivityStatus,
  amount: z.string(),                // NUMERIC as string
  currency: z.enum(["TON", "USDT"]).default("TON"),
  txHash: z.string().nullable().optional(),
  note: z.any().optional(),          // حرّة للتوسّع
  createdAt: z.string(),             // ISO
});

export type Activity = z.infer<typeof ActivityDTO>;