import { z } from "zod";

export const DisputeMessageCreateDTO = z.object({
  disputeId: z.string().uuid(),
  senderId: z.string().uuid().optional(),   // قد يملأه السيرفر
  senderUsername: z.string().optional(),
  content: z.string().min(1),
});

export const DisputeMessageDTO = z.object({
  id: z.string().uuid(),
  disputeId: z.string().uuid(),
  senderId: z.string().uuid().nullable().optional(),
  senderUsername: z.string().nullable().optional(),
  content: z.string(),
  createdAt: z.string(), // ISO
});
export type TDisputeMessageCreate = z.infer<typeof DisputeMessageCreateDTO>;
export type TDisputeMessage = z.infer<typeof DisputeMessageDTO>;