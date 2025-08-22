// shared/schema.ts
import {
  pgTable,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  uuid,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

/* =========================
   users
========================= */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(), // موجود لكن مو مستعمل بالربط
    telegramId: varchar("telegram_id", { length: 64 }).unique(),
    username: varchar("username", { length: 64 }).notNull(),
    firstName: varchar("first_name", { length: 128 }),
    lastName: varchar("last_name", { length: 128 }),
    walletAddress: varchar("wallet_address", { length: 128 }),
    role: varchar("role", { length: 32 }).notNull().default("user"),
    isVerified: boolean("is_verified").default(false),
    isBanned: boolean("is_banned").default(false),
    bannedAt: timestamp("banned_at"),
    banReason: text("ban_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    usersUnameIdx: index("users_username_idx").on(t.username),
    usersWalletIdx: index("users_wallet_idx").on(t.walletAddress),
  })
);

/* =========================
   listings
========================= */
export const listings = pgTable(
  "listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    kind: varchar("kind", { length: 16 }).notNull(),
    platform: varchar("platform", { length: 16 }),
    username: varchar("username", { length: 64 }),
    title: varchar("title", { length: 256 }),
    description: text("description"),
    price: numeric("price", { precision: 30, scale: 9 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),
    isActive: boolean("is_active").notNull().default(true),

    sellerUsername: varchar("seller_username", { length: 64 }).notNull(),
    buyerUsername: varchar("buyer_username", { length: 64 }),

    channelMode: varchar("channel_mode", { length: 16 }),
    subscribersCount: integer("subscribers_count"),
    giftsCount: integer("gifts_count"),
    giftKind: varchar("gift_kind", { length: 64 }),

    tgUserType: varchar("tg_user_type", { length: 64 }),
    followersCount: integer("followers_count"),
    accountCreatedAt: varchar("account_created_at", { length: 7 }),

    serviceType: varchar("service_type", { length: 32 }),
    target: varchar("target", { length: 16 }),
    serviceCount: integer("service_count"),

    removedByAdmin: boolean("removed_by_admin").default(false),
    removedReason: text("removed_reason"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    listingsSellerIdx: index("listings_seller_username_idx").on(t.sellerUsername),
    listingsBuyerIdx: index("listings_buyer_username_idx").on(t.buyerUsername),
  })
);

/* =========================
   payments
========================= */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id").references(() => listings.id),

    kind: varchar("kind", { length: 16 }).notNull().default("order"),
    locked: boolean("locked").notNull().default(false),

    amount: numeric("amount", { precision: 30, scale: 9 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),

    feePercent: numeric("fee_percent", { precision: 5, scale: 2 }).default("5.00"),
    feeAmount: numeric("fee_amount", { precision: 30, scale: 9 }),
    sellerAmount: numeric("seller_amount", { precision: 30, scale: 9 }),

    sellerUsername: varchar("seller_username", { length: 64 }),
    buyerUsername: varchar("buyer_username", { length: 64 }),

    escrowAddress: varchar("escrow_address", { length: 128 }),
    txHash: varchar("tx_hash", { length: 128 }),

    buyerConfirmed: boolean("buyer_confirmed").notNull().default(false),
    sellerConfirmed: boolean("seller_confirmed").notNull().default(false),

    status: varchar("status", { length: 16 }).notNull().default("pending"),
    adminAction: varchar("admin_action", { length: 16 }).notNull().default("none"),

    comment: text("comment"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at"),
  },
  (t) => ({
    payBuyerIdx: index("payments_buyer_username_idx").on(t.buyerUsername),
    paySellerIdx: index("payments_seller_username_idx").on(t.sellerUsername),
  })
);

/* =========================
   payouts
========================= */
export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id").references(() => payments.id),
    sellerUsername: varchar("seller_username", { length: 64 }).notNull(),
    toAddress: varchar("to_address", { length: 128 }).notNull(),
    amount: numeric("amount", { precision: 30, scale: 9 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),
    status: varchar("status", { length: 16 }).notNull().default("queued"),
    txHash: varchar("tx_hash", { length: 128 }),
    note: text("note"),
    adminChecked: boolean("admin_checked").notNull().default(false),
    checklist: text("checklist"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    sentAt: timestamp("sent_at"),
    confirmedAt: timestamp("confirmed_at"),
  },
  (t) => ({
    payoutsSellerIdx: index("payouts_seller_username_idx").on(t.sellerUsername),
  })
);

/* =========================
   activities
========================= */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id").references(() => payments.id),

    buyerUsername: varchar("buyer_username", { length: 64 }),
    sellerUsername: varchar("seller_username", { length: 64 }),

    type: varchar("type", { length: 24 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("completed"),
    amount: numeric("amount", { precision: 30, scale: 9 }),
    currency: varchar("currency", { length: 8 }),
    txHash: varchar("tx_hash", { length: 128 }),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    actsBuyerIdx: index("activities_buyer_username_idx").on(t.buyerUsername),
    actsSellerIdx: index("activities_seller_username_idx").on(t.sellerUsername),
  })
);

/* =========================
   disputes
========================= */
export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "cascade" }),
    buyerUsername: varchar("buyer_username", { length: 64 }),
    sellerUsername: varchar("seller_username", { length: 64 }),
    reason: text("reason"),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    evidence: text("evidence"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  }
);

/* =========================
   messages
========================= */
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  disputeId: uuid("dispute_id").references(() => disputes.id, { onDelete: "cascade" }),
  senderUsername: varchar("sender_username", { length: 64 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* =========================
   types
========================= */
export type User = InferSelectModel<typeof users>;
export type Listing = InferSelectModel<typeof listings>;
export type Payment = InferSelectModel<typeof payments>;
export type Payout = InferSelectModel<typeof payouts>;
export type Activity = InferSelectModel<typeof activities>;
export type Dispute = InferSelectModel<typeof disputes>;
export type Message = InferSelectModel<typeof messages>;

export type InsertUser = InferInsertModel<typeof users>;
export type InsertListing = InferInsertModel<typeof listings>;
export type InsertPayment = InferInsertModel<typeof payments>;
export type InsertPayout = InferInsertModel<typeof payouts>;
export type InsertActivity = InferInsertModel<typeof activities>;
export type InsertDispute = InferInsertModel<typeof disputes>;
export type InsertMessage = InferInsertModel<typeof messages>;