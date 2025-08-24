import { z } from "zod";

export const DisputeCreateDTO = z.object({
  paymentId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  reason: z.string().optional(),
  evidence: z.string().optional(),
});

export const DisputeDTO = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  status: z.enum(["open","resolved","cancelled"]),
  reason: z.string().nullable().optional(),
  evidence: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
  resolvedAt: z.string().nullable().optional(), // ISO
  createdAt: z.string(), // ISO
});
export type TDisputeCreate = z.infer<typeof DisputeCreateDTO>;
export type TDispute = z.infer<typeof DisputeDTO>;