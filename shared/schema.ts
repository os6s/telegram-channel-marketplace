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
    id: uuid("id").defaultRandom().primaryKey(),
    telegramId: varchar("telegram_id", { length: 64 }).unique(),
    username: varchar("username", { length: 64 }),
    firstName: varchar("first_name", { length: 128 }),
    lastName: varchar("last_name", { length: 128 }),
    tonWallet: varchar("ton_wallet", { length: 128 }), // legacy
    walletAddress: varchar("wallet_address", { length: 128 }), // linked withdrawal addr
    role: varchar("role", { length: 32 }).notNull().default("user"), // user | admin
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (t) => ({
    usersTelegramIdx: index("users_telegram_idx").on(t.telegramId),
    usersUsernameIdx: index("users_username_idx").on(t.username),
    usersWalletIdx: index("users_wallet_idx").on(t.walletAddress),
    usersCreatedIdx: index("users_created_idx").on(t.createdAt),
  })
);

/* =========================
   listings
========================= */
export const listings = pgTable(
  "listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Common
    kind: varchar("kind", { length: 16 }).notNull(), // username | account | channel | service
    platform: varchar("platform", { length: 16 }), // telegram | twitter | ...
    username: varchar("username", { length: 64 }),
    title: varchar("title", { length: 256 }),
    description: text("description"),
    price: numeric("price", { precision: 30, scale: 9 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),
    isVerified: boolean("is_verified").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    avatarUrl: text("avatar_url"),

    // Channel
    channelMode: varchar("channel_mode", { length: 16 }),
    subscribersCount: integer("subscribers_count"),
    giftsCount: integer("gifts_count"),
    giftKind: varchar("gift_kind", { length: 64 }),

    // Username/Account
    tgUserType: varchar("tg_user_type", { length: 64 }),

    // Account
    followersCount: integer("followers_count"),
    accountCreatedAt: varchar("account_created_at", { length: 7 }), // YYYY-MM

    // Service
    serviceType: varchar("service_type", { length: 32 }),
    target: varchar("target", { length: 16 }),
    serviceCount: integer("service_count"),

    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (t) => ({
    listingsSellerIdx: index("listings_seller_idx").on(t.sellerId),
    listingsActiveIdx: index("listings_active_idx").on(t.isActive),
    listingsPlatformIdx: index("listings_platform_idx").on(t.platform),
    listingsUsernameIdx: index("listings_username_idx").on(t.username),
    listingsCreatedIdx: index("listings_created_idx").on(t.createdAt),
  })
);

/* =========================
   payments (escrow)
========================= */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // deposit => listingId NULL, order => listingId NOT NULL
    listingId: uuid("listing_id").references(() => listings.id),
    buyerId: uuid("buyer_id").notNull().references(() => users.id),

    kind: varchar("kind", { length: 16 }).notNull().default("order"), // deposit | order
    locked: boolean("locked").notNull().default(false), // reserved balance for orders

    amount: numeric("amount", { precision: 30, scale: 9 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),
    feePercent: numeric("fee_percent", { precision: 5, scale: 2 }).notNull().default("5.00"),
    feeAmount: numeric("fee_amount", { precision: 30, scale: 9 }).notNull(),
    sellerAmount: numeric("seller_amount", { precision: 30, scale: 9 }).notNull(),
    escrowAddress: varchar("escrow_address", { length: 128 }).notNull(),
    txHash: varchar("tx_hash", { length: 128 }),

    // confirmations (manual)
    buyerConfirmed: boolean("buyer_confirmed").notNull().default(false),
    sellerConfirmed: boolean("seller_confirmed").notNull().default(false),

    // state control
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    // pending | waiting | paid | completed | disputed | refunded | cancelled

    // final admin decision (manual)
    adminAction: varchar("admin_action", { length: 16 }).notNull().default("none"),
    // none | refund | payout

    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: false }),
  },
  (t) => ({
    paymentsBuyerIdx: index("payments_buyer_idx").on(t.buyerId, t.createdAt),
    paymentsListingIdx: index("payments_listing_idx").on(t.listingId, t.createdAt),
    paymentsKindIdx: index("payments_kind_idx").on(t.kind),
    paymentsStatusIdx: index("payments_status_idx").on(t.status),
    paymentsTxIdx: index("payments_tx_idx").on(t.txHash),
    paymentsCreatedIdx: index("payments_created_idx").on(t.createdAt),
  })
);

/* =========================
   payouts (release to user/seller)
========================= */
export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // user-requested withdrawals may not tie to a specific payment
    paymentId: uuid("payment_id").references(() => payments.id),
    sellerId: uuid("seller_id").notNull().references(() => users.id),
    toAddress: varchar("to_address", { length: 128 }).notNull(),
    amount: numeric("amount", { precision: 30, scale: 9 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),
    status: varchar("status", { length: 16 }).notNull().default("queued"), // queued | sent | confirmed | failed | rejected
    txHash: varchar("tx_hash", { length: 128 }),
    note: text("note"),
    adminChecked: boolean("admin_checked").notNull().default(false),
    checklist: text("checklist"),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: false }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: false }),
  },
  (t) => ({
    payoutsSellerIdx: index("payouts_seller_idx").on(t.sellerId),
    payoutsStatusIdx: index("payouts_status_idx").on(t.status),
    payoutsPaymentIdx: index("payouts_payment_idx").on(t.paymentId),
    payoutsCreatedIdx: index("payouts_created_idx").on(t.createdAt),
  })
);

/* =========================
   activities (audit log)
========================= */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id").notNull().references(() => users.id),
    sellerId: uuid("seller_id").notNull().references(() => users.id),
    paymentId: uuid("payment_id").references(() => payments.id),
    type: varchar("type", { length: 24 }).notNull(),
    // buy | buyer_confirm | seller_confirm | admin_release | admin_refund | cancel | dispute_open | dispute_resolve
    status: varchar("status", { length: 16 }).notNull().default("completed"),
    amount: numeric("amount", { precision: 30, scale: 9 }),
    currency: varchar("currency", { length: 8 }),
    txHash: varchar("tx_hash", { length: 128 }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (t) => ({
    actsListingIdx: index("activities_listing_idx").on(t.listingId),
    actsBuyerIdx: index("activities_buyer_idx").on(t.buyerId),
    actsSellerIdx: index("activities_seller_idx").on(t.sellerId),
    actsTypeIdx: index("activities_type_idx").on(t.type),
    actsCreatedIdx: index("activities_created_idx").on(t.createdAt),
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
    buyerId: uuid("buyer_id").notNull().references(() => users.id),
    sellerId: uuid("seller_id").notNull().references(() => users.id),
    reason: text("reason"),
    status: varchar("status", { length: 16 }).notNull().default("open"), // open | reviewing | resolved | cancelled
    evidence: text("evidence"),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: false }),
  },
  (t) => ({
    disputesPaymentIdx: index("disputes_payment_idx").on(t.paymentId),
    disputesBuyerIdx: index("disputes_buyer_idx").on(t.buyerId),
    disputesSellerIdx: index("disputes_seller_idx").on(t.sellerId),
    disputesStatusIdx: index("disputes_status_idx").on(t.status),
    disputesCreatedIdx: index("disputes_created_idx").on(t.createdAt),
  })
);

/* =========================
   messages (dispute chat)
========================= */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    disputeId: uuid("dispute_id").notNull().references(() => disputes.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (t) => ({
    messagesDisputeIdx: index("messages_dispute_idx").on(t.disputeId),
    messagesSenderIdx: index("messages_sender_idx").on(t.senderId),
    messagesCreatedIdx: index("messages_created_idx").on(t.createdAt),
  })
);

/* =========================
   relations (optional)
========================= */
export const usersRelations = relations(users, ({ many }) => ({
  listings: many(listings),
  buys: many(activities),
  sells: many(activities),
  payouts: many(payouts),
  messages: many(messages),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  seller: one(users, { fields: [listings.sellerId], references: [users.id] }),
  acts: many(activities),
}));

export const disputesRelations = relations(disputes, ({ many }) => ({
  messages: many(messages),
}));

/* =========================
   types
========================= */
export type User = InferSelectModel<typeof users>;
export type InsertUser = InferInsertModel<typeof users>;

export type Listing = InferSelectModel<typeof listings>;
export type InsertListing = InferInsertModel<typeof listings>;

export type Payment = InferSelectModel<typeof payments>;
export type InsertPayment = InferInsertModel<typeof payments>;

export type Payout = InferSelectModel<typeof payouts>;
export type InsertPayout = InferInsertModel<typeof payouts>;

export type Activity = InferSelectModel<typeof activities>;
export type InsertActivity = InferInsertModel<typeof activities>;

export type Dispute = InferSelectModel<typeof disputes>;
export type InsertDispute = InferInsertModel<typeof disputes>;

export type Message = InferSelectModel<typeof messages>;
export type InsertMessage = InferInsertModel<typeof messages>;

/* =========================
   Zod schemas
========================= */
const priceRe = /^\d+(\.\d{1,9})?$/;
const yyyyMmRe = /^\d{4}-(0[1-9]|1[0-2])$/;

export const insertUserSchema = z.object({
  telegramId: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  tonWallet: z.string().optional().nullable(),
  walletAddress: z.string().optional().nullable(),
  role: z.string().optional(),
});

export const insertListingSchema = z.object({
  sellerId: z.string().uuid().optional(),
  telegramId: z.string().optional().nullable(),

  kind: z.enum(["username", "account", "channel", "service"]),
  platform: z
    .enum(["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"])
    .optional()
    .nullable(),

  username: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price: z.string().regex(priceRe),
  currency: z.enum(["TON", "USDT"]).default("TON"),
  isVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),

  channelMode: z.enum(["subscribers", "gifts"]).optional().nullable(),
  subscribersCount: z.coerce.number().int().min(0).optional().nullable(),
  giftsCount: z.coerce.number().int().min(0).optional().nullable(),
  giftKind: z.string().optional().nullable(),

  tgUserType: z.string().optional().nullable(),

  followersCount: z.coerce.number().int().min(0).optional().nullable(),
  createdAt: z.string().regex(yyyyMmRe).optional().nullable(),

  serviceType: z
    .enum(["followers", "members", "boost_channel", "boost_group"])
    .optional()
    .nullable(),
  target: z
    .enum(["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"])
    .optional()
    .nullable(),
  count: z.coerce.number().int().min(0).optional().nullable(),
});

export const insertPaymentSchema = z.object({
  listingId: z.string().uuid().optional().nullable(), // null for deposit
  buyerId: z.string().uuid(),
  kind: z.enum(["deposit", "order"]).default("order"),
  locked: z.boolean().optional().default(false),

  amount: z.string().regex(priceRe),
  currency: z.enum(["TON", "USDT"]).default("TON"),
  feePercent: z.string().regex(/^\d+(\.\d{1,2})?$/).default("5.00"),
  feeAmount: z.string().regex(priceRe).optional().nullable(),
  sellerAmount: z.string().regex(priceRe).optional().nullable(),
  escrowAddress: z.string().min(3),
  comment: z.string().optional().nullable(),
  txHash: z.string().optional().nullable(),

  buyerConfirmed: z.boolean().optional().default(false),
  sellerConfirmed: z.boolean().optional().default(false),
  status: z
    .enum(["pending", "waiting", "paid", "completed", "disputed", "refunded", "cancelled"])
    .default("pending"),
  adminAction: z.enum(["none", "refund", "payout"]).default("none"),
});

export const insertPayoutSchema = z.object({
  paymentId: z.string().uuid().optional().nullable(),
  sellerId: z.string().uuid(),
  toAddress: z.string().min(3),
  amount: z.string().regex(priceRe),
  currency: z.enum(["TON", "USDT"]).default("TON"),
  status: z.enum(["queued", "sent", "confirmed", "failed", "rejected"]).default("queued"),
  note: z.string().optional().nullable(),
  txHash: z.string().optional().nullable(),
});

export const insertActivitySchema = z.object({
  listingId: z.string().uuid().optional().nullable(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  paymentId: z.string().uuid().optional().nullable(),
  type: z.enum([
    "buy",
    "buyer_confirm",
    "seller_confirm",
    "admin_release",
    "admin_refund",
    "cancel",
    "dispute_open",
    "dispute_resolve",
  ]),
  status: z.enum(["pending", "completed", "cancelled"]).optional().default("completed"),
  amount: z.string().regex(priceRe).optional().nullable(),
  currency: z.enum(["TON", "USDT"]).optional().nullable(),
  txHash: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const insertDisputeSchema = z.object({
  paymentId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  reason: z.string().optional().nullable(),
  evidence: z.string().optional().nullable(),
  status: z.enum(["open", "reviewing", "resolved", "cancelled"]).optional().default("open"),
});

export const insertMessageSchema = z.object({
  disputeId: z.string().uuid(),
  senderId: z.string().uuid(),
  content: z.string().min(1),
});