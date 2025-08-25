import { pgTable, uuid, varchar, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const withdrawRequests = pgTable(
  "withdraw_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),
    address: varchar("address", { length: 128 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | completed | failed
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    withdrawUserIdx: index("idx_withdraw_user").on(t.userId, t.createdAt),
  })
);