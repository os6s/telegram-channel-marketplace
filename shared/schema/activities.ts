// shared/schema/activities.ts
import { pgTable, uuid, varchar, timestamp, numeric, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { activityTypeEnum, activityStatusEnum } from "./enums";
import { payments } from "./payments";
import { listings } from "./listings";
import { users } from "./users";
import { z } from "zod";

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
    actsTypeIdx: index("idx_activities_type_created").on(t.type, t.createdAt),
  })
);

/* ========= Zod insert schema ========= */
const RE_NUMERIC = /^[0-9]+(\.[0-9]+)?$/;

export const insertActivitySchema = z.object({
  listingId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
  buyerId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  type: z.enum([
    "listed",
    "buy",
    "sold",
    "buyer_confirm",
    "seller_confirm",
    "admin_release",
    "admin_refund",
    "cancel",
    "updated",
  ]),
  status: z.enum(["completed", "pending", "failed"]).optional(),
  amount: z.string().regex(RE_NUMERIC).optional(),
  currency: z.string().optional(),
  txHash: z.string().optional(),
  note: z.any().optional(),
});

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;