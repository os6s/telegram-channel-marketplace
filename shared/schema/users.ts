// shared/schema/users.ts
import { pgTable, uuid, varchar, text, boolean, timestamp, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { userRoleEnum } from "./enums";

/* =========================
   DB Table
========================= */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // نخليه number بالـ Drizzle (bigint as number)
    telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),

    username: varchar("username", { length: 64 }).unique(),
    walletAddress: varchar("wallet_address", { length: 128 }).unique(),

    role: userRoleEnum("role").notNull().default("user"),
    isVerified: boolean("is_verified").notNull().default(false),
    isBanned: boolean("is_banned").notNull().default(false),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    banReason: text("ban_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    usersUsernameIdx: index("idx_users_username").on(t.username),
    usersWalletIdx: index("idx_users_wallet").on(t.walletAddress),
    usersUsernameLowerUx: uniqueIndex("ux_users_username_lower").on(sql`lower(${t.username})`),
  })
);

/* =========================
   Zod Schemas
========================= */

// نقبل string/number/bigint للـ telegramId (نحوّله لرقم لاحقًا بالراوتر)
export const insertUserSchema = z.object({
  telegramId: z.union([z.string(), z.number(), z.bigint()]),
  // اسم المستخدم اختياري ويجوز يكون null
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .optional()
    .nullable(),
  // العنوان اختياري ويجوز يكون null (حلّ مشكلة Zod السابقة)
  walletAddress: z
    .string()
    .min(1)
    .optional()
    .nullable(),
});

export const updateUserSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).optional(),
  walletAddress: z.string().min(1).optional().nullable(),
  isVerified: z.boolean().optional(),
  isBanned: z.boolean().optional(),
  banReason: z.string().optional().nullable(),
});

/* =========================
   Types (Drizzle)
========================= */
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;