import { pgEnum } from "drizzle-orm/pg-core";

export const listingKindEnum   = pgEnum("listing_kind", ["channel","username","account","service"]);
export const platformKindEnum  = pgEnum("platform_kind", ["telegram","twitter","instagram","discord","snapchat","tiktok"]);
export const paymentStatusEnum = pgEnum("payment_status_enum", ["pending","paid","refunded","cancelled"]);
export const adminActionEnum   = pgEnum("admin_action_enum", ["none","release","refund","freeze"]);
export const disputeStatusEnum = pgEnum("dispute_status_enum", ["open","resolved","cancelled"]);
export const activityTypeEnum  = pgEnum("activity_type_enum", [
  "listed","buy","sold","buyer_confirm","seller_confirm","admin_release","admin_refund","cancel","updated",
]);
export const activityStatusEnum = pgEnum("activity_status_enum", ["completed","pending","failed"]);
export const userRoleEnum       = pgEnum("user_role_enum", ["user","admin","moderator"]);