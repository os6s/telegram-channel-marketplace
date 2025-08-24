import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { disputes } from "./disputes";

export const disputeMessages = pgTable(
  "dispute_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id, { onDelete: "cascade" }),

    senderId: uuid("sender_id"),

    senderUsername: varchar("sender_username", { length: 64 }),

    content: text("content").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxDisputeCreated: index("idx_dmsg_dispute_created").on(t.disputeId, t.createdAt),
  })
);