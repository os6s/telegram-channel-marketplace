// shared/listing.ts
import { z } from "zod";

/* ===== Enums (exactly as DB) ===== */
export const Kind = z.enum(["channel", "username", "account", "service"]);
export const Platform = z.enum(["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"]);
export const Currency = z.enum(["TON", "USDT"]); // DB يسمح varchar — نخليها محصورة هنا

// اختياريين حسب أعمدة الـ DB
export const ChannelMode = z.enum(["subscribers", "gifts"]).optional();
export const Target = z.enum(["members", "followers", "views", "sales"]).optional();

/* ===== Common helpers ===== */
const RE_NUMERIC = /^[0-9]+(\.[0-9]+)?$/;
const RE_YM = /^\d{4}-(0[1-9]|1[0-2])$/; // YYYY-MM

/* ===== Create payload (matches /api/listings POST) =====
   ملاحظة: السيرفر يستقبل price كنص (regex) مثل الراوتر الحالي.
*/
export const ListingCreateSchema = z.object({
  sellerId: z.string().uuid(),                // FK (required)
  kind: Kind,                                 // listing_kind
  platform: Platform.default("telegram"),     // platform_kind
  username: z.string().trim().min(1).optional(), // handle بدون @ (السيرفر يطبّع)
  title: z.string().trim().optional(),
  description: z.string().max(2000).optional(),

  price: z.string().regex(RE_NUMERIC),        // numeric(18,8) — الراوتر يتوقع نص
  currency: Currency.default("TON"),          // varchar(8) مع default TON

  channelMode: z.string().optional(),         // varchar(32)
  subscribersCount: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
  giftsCount: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
  giftKind: z.string().optional(),

  tgUserType: z.string().optional(),
  followersCount: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
  accountCreatedAt: z.string().regex(RE_YM).optional(), // YYYY-MM

  serviceType: z.string().optional(),
  target: z.string().optional(),
  serviceCount: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
});

/* ===== Update payload (partial) ===== */
export const ListingUpdateSchema = z.object({
  username: z.string().trim().min(1).optional(),
  title: z.string().trim().optional(),
  description: z.string().max(2000).optional(),
  price: z.string().regex(RE_NUMERIC).optional(),
  currency: Currency.optional(),

  channelMode: z.string().optional(),
  subscribersCount: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
  giftsCount: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
  giftKind: z.string().optional(),

  tgUserType: z.string().optional(),
  followersCount: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
  accountCreatedAt: z.string().regex(RE_YM).optional(),

  serviceType: z.string().optional(),
  target: z.string().optional(),
  serviceCount: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),

  isActive: z.boolean().optional(),
  removedByAdmin: z.boolean().optional(),
  removedReason: z.string().optional(),
}).partial();

/* ===== DTO (what API returns) =====
   متوافق مع select المستخدم في GET /api/listings و GET /api/listings/:id
*/
export const ListingSchema = z.object({
  id: z.string().uuid(),
  kind: Kind,
  platform: Platform,
  username: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),

  price: z.string(),                // نرجعها كنص حتى نبقى متسقين مع السيرفر
  currency: Currency,

  isActive: z.boolean(),
  createdAt: z.string(),            // ISO string
  sellerId: z.string().uuid(),
  sellerUsername: z.string().nullable().optional(),
});

/* ===== Types ===== */
export type ListingCreateDTO = z.infer<typeof ListingCreateSchema>;
export type ListingUpdateDTO = z.infer<typeof ListingUpdateSchema>;
export type ListingDTO = z.infer<typeof ListingSchema>;