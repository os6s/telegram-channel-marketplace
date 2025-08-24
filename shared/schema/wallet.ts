// shared/schema/wallet.ts
import {
  pgTable,
  uuid,
  varchar,
  numeric,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { walletDirEnum, walletRefEnum } from "./enums"; // 👈 نستورد الـEnums من مكان واحد

export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // in = زيادة, out = نقصان
    direction: walletDirEnum("direction").notNull(),

    // قيمة موجبة فقط (CHECK موجود بالـDB)
    amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),

    currency: varchar("currency", { length: 8 }).notNull().default("TON"),

    // نوع الحركة (deposit, order_hold, order_release, refund, adjustment)
    refType: walletRefEnum("ref_type").notNull(),
    refId: uuid("ref_id"),

    note: text("note"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // للاستعلام حسب المستخدم والتسلسل الزمني
    wlUserCreatedIdx: index("idx_wl_user_created").on(t.userId, t.createdAt),
    // للربط الخلفي مع عمليات أخرى (طلبات دفع/أوامر..)
    wlRefIdx: index("idx_wl_ref").on(t.refType, t.refId),
  })
);

// ✨ Types via Drizzle inference
export type WalletLedger = typeof walletLedger.$inferSelect;
export type InsertWalletLedger = typeof walletLedger.$inferInsert;