import {
  pgTable,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

/* ================= Enums ================= */
export const kindEnum = pgEnum("listing_kind", ["channel", "username", "account", "service"]);
export const platformEnum = pgEnum("platform_kind", ["telegram","twitter","instagram","discord","snapchat","tiktok"]);
export const channelModeEnum = pgEnum("channel_mode", ["subscribers","gifts"]);
export const serviceTypeEnum = pgEnum("service_type", ["followers","members","boost_channel","boost_group"]);

/* ================ Users ================ */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramId: varchar("telegram_id", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }),
  firstName: varchar("first_name", { length: 128 }),
  lastName: varchar("last_name", { length: 128 }),
  tonWallet: varchar("ton_wallet", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
});

/* ============== Channels (Unified Listings) ============== */
export const channels = pgTable("channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  sellerId: uuid("seller_id").notNull().references(() => users.id),

  // مشترك
  kind: kindEnum("kind").notNull().default("channel"),
  platform: platformEnum("platform"),
  name: varchar("name", { length: 256 }),
  // ✅ username صار اختياري حتى نسمح بـ service بدون username
  username: varchar("username", { length: 64 }).unique(),
  title: varchar("title", { length: 256 }),
  description: text("description"),
  category: varchar("category", { length: 64 }),
  price: varchar("price", { length: 64 }).notNull(), // نخزّن نص لتفادي مشاكل الفواصل
  currency: varchar("currency", { length: 8 }).notNull().default("TON"),
  isVerified: boolean("is_verified").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  avatarUrl: text("avatar_url"),

  // channel فقط
  channelMode: channelModeEnum("channel_mode"),
  subscribers: integer("subscribers").default(0),
  engagement: varchar("engagement", { length: 32 }).default("0.00"),
  // ✅ دعم هدايا القناة
  giftsCount: integer("gifts_count"),
  giftKind: varchar("gift_kind", { length: 32 }),

  // username فقط
  tgUserType: varchar("tg_user_type", { length: 32 }),

  // account فقط
  followersCount: integer("followers_count"),
  accountCreatedAt: varchar("account_created_at", { length: 64 }),

  // service فقط
  serviceType: serviceTypeEnum("service_type"),
  target: platformEnum("target"),
  serviceCount: integer("service_count"),

  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
});

/* ================ Activities ================ */
export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  channelId: uuid("channel_id").notNull().references(() => channels.id),
  buyerId: uuid("buyer_id").notNull().references(() => users.id),
  sellerId: uuid("seller_id").notNull().references(() => users.id),
  amount: varchar("amount", { length: 64 }).notNull(),
  currency: varchar("act_currency", { length: 8 }).notNull().default("TON"),
  status: varchar("status", { length: 32 }).notNull().default("completed"),
  transactionHash: varchar("tx_hash", { length: 128 }),
  completedAt: timestamp("completed_at", { withTimezone: false }).defaultNow().notNull(),
});

/* ================ Relations ================ */
export const usersRelations = relations(users, ({ many }) => ({
  listings: many(channels),
  buys: many(activities),
  sells: many(activities),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  seller: one(users, { fields: [channels.sellerId], references: [users.id] }),
  acts: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  listing: one(channels, { fields: [activities.channelId], references: [channels.id] }),
  buyer: one(users, { fields: [activities.buyerId], references: [users.id] }),
  seller: one(users, { fields: [activities.sellerId], references: [users.id] }),
}));

/* ================ TS Types ================ */
export type User = InferSelectModel<typeof users>;
export type InsertUser = InferInsertModel<typeof users>;

export type Channel = InferSelectModel<typeof channels>;
export type InsertChannel = InferInsertModel<typeof channels>;

export type Activity = InferSelectModel<typeof activities>;
export type InsertActivity = InferInsertModel<typeof activities>;

/* ================ Zod Schemas ================ */
// Users
export const insertUserSchema = createInsertSchema(users, {
  telegramId: z.string().min(1),
  username: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  tonWallet: z.string().optional().nullable(),
}).strict();

/* Utilities */
const priceRe = /^\d+(\.\d{1,9})?$/;
const yyyyMmRe = /^\d{4}-(0[1-9]|1[0-2])$/;
const normalizeUsername = (v: unknown) =>
  String(v ?? "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^t\.me\//i, "")
    .toLowerCase();

/* === Listings schema متوافق مع sellpage === */
export const insertChannelSchema = createInsertSchema(channels, {
  sellerId: z.string().uuid(),
  kind: z.enum(["channel","username","account","service"]),
  platform: z.enum(["telegram","twitter","instagram","discord","snapchat","tiktok"]).optional(),

  // username مطلوب لكل الأنواع ما عدا service
  username: z.string().min(1).optional(),
  title: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  price: z.string().regex(priceRe, "invalid price"),
  currency: z.enum(["TON","USDT"]).default("TON"),
  isVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
  avatarUrl: z.string().url().optional().nullable(),

  // channel
  channelMode: z.enum(["subscribers","gifts"]).optional().nullable(),
  subscribers: z.coerce.number().int().min(0).optional().nullable(),
  engagement: z.string().optional().nullable(),
  giftsCount: z.coerce.number().int().min(0).optional().nullable(),
  giftKind: z.string().optional().nullable(),

  // username
  tgUserType: z.string().optional().nullable(),

  // account
  followersCount: z.coerce.number().int().min(0).optional().nullable(),
  accountCreatedAt: z.string().regex(yyyyMmRe).optional().nullable(),

  // service
  serviceType: z.enum(["followers","members","boost_channel","boost_group"]).optional().nullable(),
  target: z.union([
    z.enum(["telegram","twitter","instagram","discord","snapchat","tiktok"]),
    z.literal("telegram_channel"),
    z.literal("telegram_group"),
  ]).optional().nullable(),
  serviceCount: z.coerce.number().int().min(0).optional().nullable(),
})
// مفاتيح واجهة إضافية من sellpage
.extend({
  createdAt: z.string().regex(yyyyMmRe, { message: "Expected format YYYY-MM" }).optional(),
  count: z.coerce.number().int().min(0).optional(),
})
.strip()
.superRefine((val, ctx) => {
  if (val.kind !== "service" && (!val.username || val.username.trim() === "")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["username"], message: "username is required" });
  }
})
.transform((input) => {
  const out: any = { ...input };

  // تطبيع اليوزرنيم
  if (out.username) out.username = normalizeUsername(out.username);

  // alias createdAt -> accountCreatedAt
  if (!out.accountCreatedAt && out.createdAt) out.accountCreatedAt = out.createdAt;

  // alias count -> serviceCount
  if (typeof out.serviceCount === "undefined" && typeof out.count !== "undefined") {
    out.serviceCount = out.count;
  }

  // تطبيع target aliases
  if (out.target === "telegram_channel" || out.target === "telegram_group") {
    out.target = "telegram";
  }

  delete out.createdAt;
  delete out.count;

  return out;
});

// Activities
export const insertActivitySchema = createInsertSchema(activities, {
  channelId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  amount: z.string().regex(priceRe, "invalid amount"),
  currency: z.enum(["TON","USDT"]).default("TON"),
  status: z.string().default("completed"),
  transactionHash: z.string().optional().nullable(),
}).strict();
