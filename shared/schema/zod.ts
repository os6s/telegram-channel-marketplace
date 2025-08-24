import { z } from "zod";

const RE_NUMERIC = /^[0-9]+(\.[0-9]+)?$/;

export const insertUserSchema = z.object({
  telegramId: z.union([z.string(), z.number()]).transform(String),
  username: z.string().optional(),
  walletAddress: z.string().optional(),
  role: z.enum(["user","admin","moderator"]).optional(),
});

export const insertListingSchema = z.object({
  sellerId: z.string().uuid(),
  kind: z.enum(["channel","username","account","service"]),
  platform: z.enum(["telegram","twitter","instagram","discord","snapchat","tiktok"]).default("telegram"),
  username: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.string().regex(RE_NUMERIC),
  currency: z.string().default("TON"),
  channelMode: z.string().optional(),
  subscribersCount: z.union([z.string(), z.number()]).optional(),
  followersCount: z.union([z.string(), z.number()]).optional(),
  giftsCount: z.union([z.string(), z.number()]).optional(),
  giftKind: z.string().optional(),
  tgUserType: z.string().optional(),
  accountCreatedAt: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  serviceType: z.string().optional(),
  target: z.string().optional(),
  serviceCount: z.union([z.string(), z.number()]).optional(),
});

export const insertPaymentSchema = z.object({
  listingId: z.string().uuid().optional(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  amount: z.string().regex(RE_NUMERIC),
  currency: z.string().default("TON"),
  feePercent: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  comment: z.string().optional(),
  escrowAddress: z.string().optional(),
  txHash: z.string().optional(),
});

export const insertActivitySchema = z.object({
  listingId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
  buyerId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  type: z.enum([
    "listed","buy","sold","buyer_confirm","seller_confirm","admin_release","admin_refund","cancel","updated",
  ]),
  status: z.enum(["completed","pending","failed"]).optional(),
  amount: z.string().regex(RE_NUMERIC).optional(),
  currency: z.string().optional(),
  txHash: z.string().optional(),
  note: z.any().optional(),
});

export const insertDisputeSchema = z.object({
  paymentId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  reason: z.string().optional(),
  evidence: z.string().optional(),
});