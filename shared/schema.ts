// shared/schema.ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  numeric,
  index,
  pgEnum,
  bigint,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { z } from "zod";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/* =========================
   Enums (match DB)
========================= */
export const listingKindEnum   = pgEnum("listing_kind", ["channel","username","account","service"]);
export const platformKindEnum  = pgEnum("platform_kind", ["telegram","twitter","instagram","discord","snapchat","tiktok"]);
export const paymentStatusEnum = pgEnum("payment_status_enum", ["pending","paid","refunded","cancelled"]);
export const adminActionEnum   = pgEnum("admin_action_enum", ["none","release","refund","freeze"]);
export const disputeStatusEnum = pgEnum("dispute_status_enum", ["open","resolved","cancelled"]);
export const activityTypeEnum  = pgEnum("activity_type_enum", [
  "listed","buy","sold","buyer_confirm","seller_confirm","admin_release","admin_refund","cancel","updated",
]);
export const activityStatusEnum = pgEnum("activity_status_enum", ["completed","pending","failed"]);
export const userRoleEnum       = pgEnum("user_role_enum", ["user","admin","moderator"]);

/* =========================
   users
========================= */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
    username: varchar("username", { length: 64 }).unique(), // قد يكون NULL
    walletAddress: varchar("wallet_address", { length: 128 }).unique(),
    tonWallet: varchar("ton_wallet", { length: 128 }),
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
  })
);

/* =========================
   listings
========================= */
export const listings = pgTable(
  "listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    sellerId: uuid("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id").references(() => users.id, { onDelete: "set null" }),

    kind: listingKindEnum("kind").notNull(),
    platform: platformKindEnum("platform").notNull().default("telegram"),

    username: varchar("username", { length: 64 }), // الـ handle المعروض (قد يكون NULL للخدمات)
    title: varchar("title", { length: 200 }),
    description: text("description"),

    price: numeric("price", { precision: 18, scale: 8 }).notNull().default("0"),
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),

    channelMode: varchar("channel_mode", { length: 32 }),
    subscribersCount: integer("subscribers_count"),
    followersCount: integer("followers_count"), // ⬅️ مضاف لأن الراوتر يستخدمه
    giftsCount: integer("gifts_count"),
    giftKind: varchar("gift_kind", { length: 64 }),

    tgUserType: varchar("tg_user_type", { length: 64 }),
    accountCreatedAt: varchar("account_created_at", { length: 7 }), // YYYY-MM

    serviceType: varchar("service_type", { length: 64 }),
    target: varchar("target", { length: 32 }),
    serviceCount: integer("service_count"),

    isActive: boolean("is_active").notNull().default(true),
    removedByAdmin: boolean("removed_by_admin").notNull().default(false),
    removedReason: text("removed_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    listingsSellerIdx: index("idx_listings_seller").on(t.sellerId),
    listingsPlatCreateIdx: index("idx_listings_platform_created").on(t.platform, t.createdAt),
    listingsActiveIdx: index("idx_listings_active").on(t.isActive),
  })
);

/* =========================
   payments
========================= */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    buyerId: uuid("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id").notNull().references(() => users.id, { onDelete: "restrict" }),

    amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),

    feePercent: numeric("fee_percent", { precision: 5, scale: 2 }).notNull().default("5.00"),
    feeAmount: numeric("fee_amount", { precision: 18, scale: 8 }).notNull(),
    sellerAmount: numeric("seller_amount", { precision: 18, scale: 8 }).notNull(),

    escrowAddress: varchar("escrow_address", { length: 128 }).notNull(),
    txHash: varchar("tx_hash", { length: 128 }),

    buyerConfirmed: boolean("buyer_confirmed").notNull().default(false),
    sellerConfirmed: boolean("seller_confirmed").notNull().default(false),

    status: paymentStatusEnum("status").notNull().default("pending"),
    adminAction: adminActionEnum("admin_action").notNull().default("none"),
    comment: text("comment"),
    locked: boolean("locked").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    paymentsBuyerCreatedIdx: index("idx_payments_buyer_created").on(t.buyerId, t.createdAt),
    paymentsListingStatusIdx: index("idx_payments_listing_status").on(t.listingId, t.status),
    paymentsStatusCreatedIdx: index("idx_payments_status_created").on(t.status, t.createdAt),
  })
);

/* =========================
   disputes
========================= */
export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    reason: text("reason"),
    evidence: text("evidence"),

    status: disputeStatusEnum("status").notNull().default("open"),
    resolution: text("resolution"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    disputesParticipantsIdx: index("idx_disputes_participants").on(t.buyerId, t.sellerId),
    disputesStatusIdx: index("idx_disputes_status").on(t.status, t.createdAt),
  })
);

/* =========================
   dispute_messages  (التصدير باسم messages للتوافق)
========================= */
export const messages = pgTable(
  "dispute_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    disputeId: uuid("dispute_id").notNull().references(() => disputes.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    senderUsername: varchar("sender_username", { length: 64 }), // كاش اختياري للعرض
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dmsgIndex: index("idx_dmsg_dispute_created").on(t.disputeId, t.createdAt),
  })
);

/* =========================
   activities
========================= */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    buyerId: uuid("buyer_id").references(() => users.id, { onDelete: "set null" }),
    sellerId: uuid("seller_id").references(() => users.id, { onDelete: "set null" }),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),

    type: activityTypeEnum("type").notNull(),
    status: activityStatusEnum("status").notNull().default("completed"),

    amount: numeric("amount", { precision: 18, scale: 8 }),
    currency: varchar("currency", { length: 8 }),

    txHash: varchar("tx_hash", { length: 128 }),
    note: jsonb("note").notNull().default(sql`'{}'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    actsPaymentIdx: index("idx_activities_payment_created").on(t.paymentId, t.createdAt),
    actsListingIdx: index("idx_activities_listing_created").on(t.listingId, t.createdAt),
  })
);

/* =========================
   payouts  ⬅️ مضاف
========================= */
export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
    sellerId: uuid("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    toAddress: varchar("to_address", { length: 128 }).notNull(),
    amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),
    status: varchar("status", { length: 16 }).notNull().default("queued"), // queued/sent/confirmed/failed/rejected
    txHash: varchar("tx_hash", { length: 128 }),
    note: text("note"),
    adminChecked: boolean("admin_checked").notNull().default(false),
    checklist: text("checklist"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => ({
    payoutsSellerIdx: index("idx_payouts_seller").on(t.sellerId),
    payoutsStatusIdx: index("idx_payouts_status").on(t.status),
  })
);

/* =========================
   relations (اختياري)
========================= */
export const listingsRelations = relations(listings, ({ one }) => ({
  seller: one(users, { fields: [listings.sellerId], references: [users.id] }),
  buyer: one(users, { fields: [listings.buyerId], references: [users.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  listing: one(listings, { fields: [payments.listingId], references: [listings.id] }),
  buyer: one(users, { fields: [payments.buyerId], references: [users.id] }),
  seller: one(users, { fields: [payments.sellerId], references: [users.id] }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  payment: one(payments, { fields: [disputes.paymentId], references: [payments.id] }),
  buyer: one(users, { fields: [disputes.buyerId], references: [users.id] }),
  seller: one(users, { fields: [disputes.sellerId], references: [users.id] }),
}));

/* =========================
   Types
========================= */
export type User = InferSelectModel<typeof users>;
export type Listing = InferSelectModel<typeof listings>;
export type Payment = InferSelectModel<typeof payments>;
export type Dispute = InferSelectModel<typeof disputes>;
export type Message = InferSelectModel<typeof messages>;
export type Activity = InferSelectModel<typeof activities>;
export type Payout = InferSelectModel<typeof payouts>;

export type InsertUser = InferInsertModel<typeof users>;
export type InsertListing = InferInsertModel<typeof listings>;
export type InsertPayment = InferInsertModel<typeof payments>;
export type InsertDispute = InferInsertModel<typeof disputes>;
export type InsertMessage = InferInsertModel<typeof messages>;
export type InsertActivity = InferInsertModel<typeof activities>;
export type InsertPayout = InferInsertModel<typeof payouts>;

/* =========================
   Zod insert schemas (routers input)
========================= */
const RE_NUMERIC = /^[0-9]+(\.[0-9]+)?$/;

export const insertUserSchema = z.object({
  telegramId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  username: z.string().optional(), // ممكن يكون null بالـ DB
  walletAddress: z.string().optional(),
  tonWallet: z.string().optional(),
  role: z.enum(["user","admin","moderator"]).optional(),
});

export const insertListingSchema = z.object({
  sellerId: z.string().uuid(),
  kind: z.enum(["channel","username","account","service"]),
  platform: z.enum(["telegram","twitter","instagram","discord","snapchat","tiktok"]).default("telegram"),
  username: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.string().regex(RE_NUMERIC),
  currency: z.string().default("TON"),
  channelMode: z.string().optional(),
  subscribersCount: z.union([z.string(), z.number()]).optional(),
  followersCount: z.union([z.string(), z.number()]).optional(), // ⬅️ مضاف
  giftsCount: z.union([z.string(), z.number()]).optional(),
  giftKind: z.string().optional(),
  tgUserType: z.string().optional(),
  accountCreatedAt: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(), // YYYY-MM
  serviceType: z.string().optional(),
  target: z.string().optional(),
  serviceCount: z.union([z.string(), z.number()]).optional(),
});

export const insertPaymentSchema = z.object({
  listingId: z.string().uuid().optional(), // SET NULL مسموح لاحقاً
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  amount: z.string().regex(RE_NUMERIC),
  currency: z.string().default("TON"),
  feePercent: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  comment: z.string().optional(),
  escrowAddress: z.string().optional(),
  txHash: z.string().optional(),
});

export const insertActivitySchema = z.object({
  listingId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
  buyerId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  type: z.enum([
    "listed","buy","sold","buyer_confirm","seller_confirm","admin_release","admin_refund","cancel","updated",
  ]),
  status: z.enum(["completed","pending","failed"]).optional(),
  amount: z.string().regex(RE_NUMERIC).optional(),
  currency: z.string().optional(),
  txHash: z.string().optional(),
  note: z.any().optional(), // json
});

export const insertDisputeSchema = z.object({
  paymentId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  reason: z.string().optional(),
  evidence: z.string().optional(),
});