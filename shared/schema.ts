// shared/schema.ts
import { pgTable, text, varchar, boolean, integer, timestamp, numeric, pgEnum, uuid } from "drizzle-orm/pg-core";

// enums اختيارية
export const kindEnum = pgEnum("listing_kind", ["channel","username","account","service"]);
export const platformEnum = pgEnum("platform_kind", ["telegram","twitter","instagram","discord","snapchat","tiktok"]);
export const channelModeEnum = pgEnum("channel_mode", ["subscribers","gifts"]);
export const serviceTypeEnum = pgEnum("service_type", ["followers","members","boost_channel","boost_group"]);

// users (بدون تغيير إن كان موجود)
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramId: varchar("telegram_id", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }),
  firstName: varchar("first_name", { length: 128 }),
  lastName: varchar("last_name", { length: 128 }),
  tonWallet: varchar("ton_wallet", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
});

// ✅ نستخدم جدولك الحالي channels كـ listings موحّدة
export const channels = pgTable("channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  sellerId: uuid("seller_id").notNull().references(() => users.id),
  // موحّد
  kind: kindEnum("kind").notNull().default("channel"),
  platform: platformEnum("platform"),
  username: varchar("username", { length: 64 }).notNull().unique(),  // نطبّعها بالراوتر
  title: varchar("title", { length: 256 }),
  description: text("description"),
  price: varchar("price", { length: 64 }).notNull(),                 // إبقِها نص لتجنّب مشاكل الفاصلة
  currency: varchar("currency", { length: 8 }).notNull().default("TON"),
  isVerified: boolean("is_verified").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  avatarUrl: text("avatar_url"),

  // channel فقط
  channelMode: channelModeEnum("channel_mode"),
  subscribers: integer("subscribers").default(0),
  engagement: varchar("engagement", { length: 32 }).default("0.00"),

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

// activities تبقى كما هي لو عندك بالفعل
export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  channelId: uuid("channel_id").notNull().references(() => channels.id), // يبقى الاسم كما هو
  buyerId: uuid("buyer_id").notNull().references(() => users.id),
  sellerId: uuid("seller_id").notNull().references(() => users.id),
  amount: varchar("amount", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("completed"),
  completedAt: timestamp("completed_at", { withTimezone: false }).defaultNow().notNull(),
});