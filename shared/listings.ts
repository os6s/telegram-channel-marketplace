// shared/listing.ts
import { z } from "zod";

export const Kind = z.enum(["username","account","channel","service"]);
export const Platform = z.enum(["telegram","twitter","instagram","discord","snapchat","tiktok"]);
export const ChannelMode = z.enum(["subscribers","gifts"]);
export const ServiceType = z.enum(["followers","members","boost_channel","boost_group"]);
export const Currency = z.enum(["TON","USDT"]);

export const ListingCreateSchema = z.object({
  sellerId: z.string().min(1),
  kind: Kind,
  platform: Platform.optional(),
  channelMode: ChannelMode.optional(),
  serviceType: ServiceType.optional(),
  username: z.string().optional(),      // لقناة/يوزر
  title: z.string().optional(),
  subscribers: z.coerce.number().int().nonnegative().optional(),
  price: z.coerce.number().positive(),
  currency: Currency,
  description: z.string().max(2000).optional(),
  isVerified: z.boolean().optional(),
});

export const ListingSchema = ListingCreateSchema.extend({
  id: z.string(),
  createdAt: z.string(), // ISO
});

export type Kind = z.infer<typeof Kind>;
export type Platform = z.infer<typeof Platform>;
export type ChannelMode = z.infer<typeof ChannelMode>;
export type ServiceType = z.infer<typeof ServiceType>;
export type Currency = z.infer<typeof Currency>;
export type ListingCreateInput = z.infer<typeof ListingCreateSchema>;
export type ListingDTO = z.infer<typeof ListingSchema>;