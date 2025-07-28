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
  growth: decimal("growth", { precision: 5, scale: 2 }).notNull(),
  price: decimal("price", { precision: 18, scale: 9 }).notNull(), // TON amount
  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),
  avatarUrl: text("avatar_url"),
});

export const escrows = pgTable("escrows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull(),
  buyerId: varchar("buyer_id").notNull(),
  sellerId: varchar("seller_id").notNull(),
  amount: decimal("amount", { precision: 18, scale: 9 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, verified, completed, cancelled
  botToken: text("bot_token"), // For verification
  expiresAt: text("expires_at").notNull(),
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
  price: z.string().regex(/^\d+(\.\d{1,9})?$/, "Invalid TON amount"),
  subscribers: z.number().min(1, "Must have at least 1 subscriber"),
  engagement: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid engagement rate"),
  growth: z.string().regex(/^[+-]?\d+(\.\d{1,2})?$/, "Invalid growth rate"),
});

export const insertEscrowSchema = createInsertSchema(escrows).omit({
  id: true,
  sellerId: true,
  status: true,
  expiresAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Channel = typeof channels.$inferSelect;
export type InsertEscrow = z.infer<typeof insertEscrowSchema>;
export type Escrow = typeof escrows.$inferSelect;
