// shared/schema/enums.ts
import { pgEnum } from "drizzle-orm/pg-core";

/* ===== payments ===== */
export const paymentStatusEnum = pgEnum("payment_status_enum", [
  "waiting",   // للإيداع قبل التأكد
  "pending",   // فتح الطلب/الاسكرو
  "paid",      // تم التأكيد/الإفراج
  "refunded",  // أرجعنا المبلغ
  "cancelled", // ألغينا العملية
]);

export const adminActionEnum = pgEnum("admin_action_enum", [
  "none",
  "release",
  "refund",
  "freeze",
]);

export const paymentKindEnum = pgEnum("payment_kind_enum", [
  "order",
  "deposit",
]);

/* ===== wallet (ledger) ===== */
export const walletDirEnum = pgEnum("wallet_dir_enum", [
  "in",
  "out",
]);

export const walletRefEnum = pgEnum("wallet_ref_enum", [
  "deposit",
  "order_hold",
  "order_release",
  "refund",
  "adjustment",
  "withdraw", // نضيفها حتى تتوافق مع الـ DTO
]);