// shared/schema/payments.ts
import { pgTable, uuid, varchar, boolean, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { paymentStatusEnum, adminActionEnum, paymentKindEnum } from "./enums";
import { listings } from "./listings";
import { users } from "./users";
import { z } from "zod";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    buyerId: uuid("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    // NOTE: خاليناه غير إجباري حتى يدعم kind=deposit
    sellerId: uuid("seller_id").references(() => users.id, { onDelete: "restrict" }),

    kind: paymentKindEnum("kind").notNull().default("order"),

    amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),

    feePercent: numeric("fee_percent", { precision: 5, scale: 2 }).notNull().default("5.00"),
    feeAmount: numeric("fee_amount", { precision: 18, scale: 8 }).notNull().default("0"),
    sellerAmount: numeric("seller_amount", { precision: 18, scale: 8 }).notNull().default("0"),

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
    paymentsKindIdx: index("idx_payments_kind_created").on(t.kind, t.createdAt),
  })
);

// ---------- Zod insert schema (مطلوبها الراوتر) ----------
const RE_NUMERIC = /^[0-9]+(\.[0-9]+)?$/;

export const insertPaymentSchema = z.object({
  listingId: z.string().uuid().nullable().optional(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid().nullable().optional(), // يسمح null للـ deposit
  kind: z.enum(["order", "deposit"]).default("order"),
  amount: z.string().regex(RE_NUMERIC),
  currency: z.string().default("TON"),
  feePercent: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  comment: z.string().optional(),
  escrowAddress: z.string().optional(),
  txHash: z.string().optional(),
});