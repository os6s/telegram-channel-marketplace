import { pgTable, uuid, text, timestamp, index, varchar } from "drizzle-orm/pg-core";
import { disputeStatusEnum } from "./enums";
import { payments } from "./payments";
import { users } from "./users";

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

export const messages = pgTable(
  "dispute_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    disputeId: uuid("dispute_id").notNull().references(() => disputes.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    senderUsername: varchar("sender_username", { length: 64 }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dmsgIndex: index("idx_dmsg_dispute_created").on(t.disputeId, t.createdAt),
  })
);