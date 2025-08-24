// shared/schema/payments.ts
import { pgTable, uuid, varchar, boolean, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { paymentStatusEnum, adminActionEnum, paymentKindEnum } from "./enums";
import { listings } from "./listings";
import { users } from "./users";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // روابط اختيارية لأن بعض السجلات (مثل الإيداع) قد لا تملك Listing/Seller
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    buyerId: uuid("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id").references(() => users.id, { onDelete: "set null" }),

    // نوع الحركة: order | deposit
    kind: paymentKindEnum("kind").notNull().default("order"),

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
    comment: varchar("comment", { length: 2048 }),
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
    paymentsKindIdx: index("idx_payments_kind_created").on(t.kind, t.createdAt), // لاستعلامات لوحة الأدمن
  })
);