-- Schema for Telegram Channel Marketplace (Adjusted to match drizzle schema.ts)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "users" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "telegram_id" text NOT NULL UNIQUE,
  "username" text,
  "first_name" text,
  "last_name" text,
  "ton_wallet" text
);

CREATE TABLE IF NOT EXISTS "channels" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "seller_id" varchar(36) NOT NULL,
  "name" text NOT NULL,
  "username" text NOT NULL UNIQUE,
  "description" text NOT NULL,
  "category" text NOT NULL,
  "subscribers" integer NOT NULL,
  "engagement" decimal(5,2) NOT NULL,
  "price" decimal(18,9) NOT NULL,
  "is_verified" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "avatar_url" text,
  CONSTRAINT channels_seller_id_fk FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS "activities" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id" varchar(36) NOT NULL,
  "buyer_id" varchar(36) NOT NULL,
  "seller_id" varchar(36) NOT NULL,
  "amount" decimal(18,9) NOT NULL,
  "status" text NOT NULL DEFAULT 'completed',
  "transaction_hash" text,
  "completed_at" text NOT NULL,
  "gift_type" text,
  CONSTRAINT activities_channel_id_fk FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT activities_buyer_id_fk FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT activities_seller_id_fk FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "channels_category_idx" ON "channels" ("category");
CREATE INDEX IF NOT EXISTS "channels_price_idx" ON "channels" ("price");
CREATE INDEX IF NOT EXISTS "activities_status_idx" ON "activities" ("status");