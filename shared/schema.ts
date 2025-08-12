import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  tonWallet: text("ton_wallet"),
});

export const channels = pgTable("channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  subscribers: integer("subscribers").notNull(),
  engagement: decimal("engagement", { precision: 5, scale: 2 }).notNull(),
  price: decimal("price", { precision: 18, scale: 9 }).notNull(),
  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),
  avatarUrl: text("avatar_url"),
});

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull(),
  buyerId: varchar("buyer_id").notNull(),
  sellerId: varchar("seller_id").notNull(),
  amount: decimal("amount", { precision: 18, scale: 9 }).notNull(),
  status: text("status").notNull().default("completed"),
  transactionHash: text("transaction_hash"),
  completedAt: text("completed_at").notNull(),
  giftType: text("gift_type"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertChannelSchema = createInsertSchema(channels).omit({
  id: true,
  sellerId: true,
  isVerified: true,
  isActive: true,
}).extend({
  // أخفّ: نقبل أي سترنغ بطول منطقي. السيرفر يطبّع ويطبّق regex النهائي.
  username: z.string().trim().min(5, "Username must be at least 5 characters").max(64, "Username cannot exceed 64 characters"),

  // تقبّل رقم أو نص وتحوله لصيغة نص رقمية بدقة TON (حتى 9 منازل)
  price: z.preprocess(
    (v) => typeof v === "number" ? v.toString() : v,
    z.string().regex(/^\d+(\.\d{1,9})?$/, "Invalid TON amount")
  ),

  // تقبّل "123" أو 123 وتحوّله لعدد صحيح ≥ 1
  subscribers: z.preprocess(
    (v) => typeof v === "string" ? parseInt(v, 10) : v,
    z.number().int().min(1, "Must have at least 1 subscriber")
  ),

  // تقبّل رقم أو نص وتثبّت دقتـه كسلسلة حتى منزلتين (0–99.99 يُفحَص لاحقاً إذا تريد)
  engagement: z.preprocess(
    (v) => typeof v === "number" ? v.toFixed(2) : v,
    z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid engagement rate")
  ),
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  sellerId: true,
  status: true,
  completedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Channel = typeof channels.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

export type GiftType = "statue-of-liberty" | "flame-of-liberty";