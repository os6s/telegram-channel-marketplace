import { z } from "zod";

export const Kind = z.enum(["channel","username","account","service"]);
export const Platform = z.enum(["telegram","twitter","instagram","discord","snapchat","tiktok"]);
export const Currency = z.enum(["TON","USDT"]);

const RE_NUM = /^[0-9]+(\.[0-9]+)?$/;
const RE_YM  = /^\d{4}-(0[1-9]|1[0-2])$/;

export const ListingCreateDTO = z.object({
  sellerId: z.string().uuid(),
  kind: Kind,
  platform: Platform.default("telegram"),
  username: z.string().trim().min(1).optional(),
  title: z.string().trim().optional(),
  description: z.string().max(2000).optional(),
  price: z.string().regex(RE_NUM),
  currency: Currency.default("TON"),
  channelMode: z.string().optional(),
  subscribersCount: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional(),
  followersCount: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional(),
  giftsCount: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional(),
  giftKind: z.string().optional(),
  tgUserType: z.string().optional(),
  accountCreatedAt: z.string().regex(RE_YM).optional(),
  serviceType: z.string().optional(),
  target: z.string().optional(),
  serviceCount: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional(),
});

export const ListingUpdateDTO = ListingCreateDTO.partial();

export const ListingDTO = z.object({
  id: z.string().uuid(),
  kind: Kind,
  platform: Platform,
  username: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  price: z.string(),
  currency: Currency,
  isActive: z.boolean(),
  createdAt: z.string(), // ISO
  sellerId: z.string().uuid(),
  sellerUsername: z.string().nullable().optional(),
});
export type TListingCreate = z.infer<typeof ListingCreateDTO>;
export type TListingUpdate = z.infer<typeof ListingUpdateDTO>;
export type TListing = z.infer<typeof ListingDTO>;