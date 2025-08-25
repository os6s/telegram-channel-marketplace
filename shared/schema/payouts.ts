import { pgTable, uuid, varchar, boolean, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { payments } from "./payments";

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // ممكن يرتبط بـ payment معين، أو null
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),

    // مو بس seller، أي مستخدم عنده رصيد
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    toAddress: varchar("to_address", { length: 128 }).notNull(),
    amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),

    // pending → processing → completed | failed
    status: varchar("status", { length: 16 }).notNull().default("pending"),

    txHash: varchar("tx_hash", { length: 128 }),
    note: varchar("note", { length: 2048 }),

    adminChecked: boolean("admin_checked").notNull().default(false),
    checklist: varchar("checklist", { length: 2048 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => ({
    payoutsUserIdx: index("idx_payouts_user").on(t.userId),
    payoutsStatusIdx: index("idx_payouts_status").on(t.status),
  })
);