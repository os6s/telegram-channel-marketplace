// shared/schema/enums.ts
import { pgEnum } from "drizzle-orm/pg-core";

/* ===== users ===== */
export const userRoleEnum = pgEnum("user_role_enum", [
  "user",
  "moderator",
  "admin",
]);

/* ===== listings ===== */
export const listingKindEnum = pgEnum("listing_kind_enum", [
  "channel",
  "username",
  "account",
  "service",
]);

export const platformKindEnum = pgEnum("platform_kind_enum", [
  "telegram",
  "twitter",
  "instagram",
  "discord",
  "snapchat",
  "tiktok",
]);

/* ===== disputes ===== */
export const disputeStatusEnum = pgEnum("dispute_status_enum", [
  "open",
  "resolved",
  "cancelled",
]);

/* ===== activities ===== */
export const activityTypeEnum = pgEnum("activity_type_enum", [
  "list",
  "update",
  "buy",
  "buyer_confirm",
  "admin_release",
  "admin_refund",
  "other",
]);

export const activityStatusEnum = pgEnum("activity_status_enum", [
  "pending",
  "completed",
  "failed",
]);

/* ===== payments ===== */
export const paymentStatusEnum = pgEnum("payment_status_enum", [
  "waiting",
  "pending",
  "paid",
  "refunded",
  "cancelled",
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
export const walletDirEnum = pgEnum("wallet_dir_enum", ["in", "out"]);

export const walletRefEnum = pgEnum("wallet_ref_enum", [
  "deposit",
  "order_hold",
  "order_release",
  "refund",
  "adjustment",
  "withdraw",
]);