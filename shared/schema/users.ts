import { pgTable, uuid, varchar, text, boolean, timestamp, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { userRoleEnum } from "./enums";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
    username: varchar("username", { length: 64 }).unique(),
    walletAddress: varchar("wallet_address", { length: 128 }).unique(),
    // تم حذف tonWallet نهائياً
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