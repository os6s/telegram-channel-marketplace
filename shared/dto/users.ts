import { z } from "zod";

export const UserDTO = z.object({
  id: z.string().uuid(),
  telegramId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  username: z.string().nullable().optional(),
  walletAddress: z.string().nullable().optional(), // بدون tonWallet
  role: z.enum(["user","admin","moderator"]),
  isVerified: z.boolean(),
  isBanned: z.boolean(),
  createdAt: z.string(), // ISO
});
export type TUser = z.infer<typeof UserDTO>;
