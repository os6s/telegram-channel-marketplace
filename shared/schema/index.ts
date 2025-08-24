// shared/schema/index.ts

export * from "./enums";
export * from "./users";
export * from "./listings";
export * from "./payments";
export * from "./disputes";
export * from "./activities";
export * from "./payouts";
export * from "./wallet";     // <-- إذا ضايف ملف wallet الجديد
export * from "./views";
export * from "./relations";
export * from "./zod";

export type {
  InferInsertModel as InsertModel,
  InferSelectModel as SelectModel,
} from "drizzle-orm";