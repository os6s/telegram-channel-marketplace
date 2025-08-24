// shared/schema/wallet.ts
import {
  pgTable,
  uuid,
  varchar,
  numeric,
  text,
  timestamp,
  index,
  pgEnum,
  pgView,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { users } from "./users";

/* ===== Enums (مطابقة للّّي صنعناه بالداتابيس) ===== */
export const walletDirEnum = pgEnum("wallet_dir_enum", ["in", "out"]);
export const walletRefEnum = pgEnum("wallet_ref_enum", [
  "deposit",
  "order_hold",
  "order_release",
  "refund",
  "adjustment",
]);

/* ===== Table: wallet_ledger ===== */
export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    direction: walletDirEnum("direction").notNull(), // in = زيادة, out = نقصان
    amount: numeric("amount", { precision: 18, scale: 8 }).notNull(), // > 0 (مفروضها بالـ CHECK في DB)
    currency: varchar("currency", { length: 8 }).notNull().default("TON"),

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

/* ===== View: wallet_balances (existing) =====
   لازم تكون الفيو منشَأة مسبقاً في PostgreSQL:
   CREATE VIEW wallet_balances AS
   SELECT user_id, currency,
          SUM(CASE WHEN direction='in' THEN amount ELSE -amount END) AS balance
   FROM wallet_ledger
   GROUP BY user_id, currency;
*/
export const walletBalancesView = pgView("wallet_balances", {
  userId: uuid("user_id"),
  currency: varchar("currency", { length: 8 }),
  balance: numeric("balance", { precision: 18, scale: 8 }),
}).existing();

/* ===== Zod Schemas (للإدخال من الراوتر) ===== */
const RE_NUMERIC = /^[0-9]+(\.[0-9]+)?$/;

export const insertWalletEntrySchema = z.object({
  userId: z.string().uuid(),
  direction: z.enum(["in", "out"]),
  amount: z.string().regex(RE_NUMERIC), // نحافظها كنص مثل باقي السكيمة
  currency: z.string().default("TON"),
  refType: z.enum(["deposit", "order_hold", "order_release", "refund", "adjustment"]),
  refId: z.string().uuid().optional(),
  note: z.string().optional(),
});

/* ===== Types ===== */
export type WalletLedgerRow = {
  id: string;
  userId: string;
  direction: "in" | "out";
  amount: string; // Numeric as string (اتساقاً مع باقي الجداول)
  currency: string;
  refType: "deposit" | "order_hold" | "order_release" | "refund" | "adjustment";
  refId: string | null;
  note: string | null;
  createdAt: Date;
};

export type WalletBalanceRow = {
  userId: string;
  currency: string | null;
  balance: string | null; // numeric as string
};