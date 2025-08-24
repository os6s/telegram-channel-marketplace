// shared/dto/activities.ts
import { z } from "zod";

export const ActivityType = z.enum([
  "list",          // عرض/نشر
  "update",        // تحديث إعلان
  "buy",           // فتح طلب شراء
  "buyer_confirm", // تأكيد المشتري
  "admin_release", // إفراج أدمن
  "admin_refund",  // رَدّ أدمن
  "other",
]);

export const ActivityStatus = z.enum(["pending", "completed", "failed"]);

const RE_NUMERIC = /^[0-9]+(\.[0-9]+)?$/;

export const insertActivitySchema = z.object({
  listingId: z.string().uuid().nullable().optional(),
  buyerId: z.string().uuid().nullable().optional(),
  sellerId: z.string().uuid().nullable().optional(),
  paymentId: z.string().uuid().nullable().optional(),
  type: ActivityType,
  status: ActivityStatus,
  amount: z.string().regex(RE_NUMERIC).nullable().optional(),
  currency: z.string().default("TON").optional(),
  txHash: z.string().nullable().optional(),
  note: z.any().optional(), // تُخزن JSON
});

export type InsertActivityDTO = z.infer<typeof insertActivitySchema>;