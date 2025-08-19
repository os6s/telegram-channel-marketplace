-- 0002_add_payments_payouts_disputes.sql
-- Adds: payments, payouts, disputes, messages
-- Ensures optional columns on activities & listings exist

-- Needed for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- payments
CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "listing_id" uuid NOT NULL REFERENCES "listings"("id"),
  "buyer_id" uuid NOT NULL REFERENCES "users"("id"),
  "amount" numeric(30,9) NOT NULL,
  "currency" varchar(8) NOT NULL DEFAULT 'TON',
  "fee_percent" numeric(5,2) NOT NULL DEFAULT 5.00,
  "fee_amount" numeric(30,9) NOT NULL,
  "seller_amount" numeric(30,9) NOT NULL,
  "escrow_address" varchar(128) NOT NULL,
  "tx_hash" varchar(128),
  "buyer_confirmed" boolean NOT NULL DEFAULT false,
  "seller_confirmed" boolean NOT NULL DEFAULT false,
  "status" varchar(16) NOT NULL DEFAULT 'pending',
  -- pending | waiting | completed | disputed | refunded | cancelled
  "admin_action" varchar(16) NOT NULL DEFAULT 'none',
  -- none | refund | payout
  "comment" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "confirmed_at" timestamp
);

-- payouts
CREATE TABLE IF NOT EXISTS "payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "payment_id" uuid NOT NULL REFERENCES "payments"("id"),
  "seller_id" uuid NOT NULL REFERENCES "users"("id"),
  "to_address" varchar(128) NOT NULL,
  "amount" numeric(30,9) NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'queued', -- queued | sent | confirmed | failed
  "tx_hash" varchar(128),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "sent_at" timestamp,
  "confirmed_at" timestamp
);

-- disputes
CREATE TABLE IF NOT EXISTS "disputes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "payment_id" uuid NOT NULL REFERENCES "payments"("id") ON DELETE CASCADE,
  "buyer_id" uuid NOT NULL REFERENCES "users"("id"),
  "seller_id" uuid NOT NULL REFERENCES "users"("id"),
  "reason" text,
  "status" varchar(16) NOT NULL DEFAULT 'open', -- open | reviewing | resolved | cancelled
  "evidence" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "resolved_at" timestamp
);

-- messages (dispute chat)
CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dispute_id" uuid NOT NULL REFERENCES "disputes"("id") ON DELETE CASCADE,
  "sender_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Ensure optional columns exist on activities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='activities' AND column_name='payment_id'
  ) THEN
    ALTER TABLE "activities" ADD COLUMN "payment_id" uuid REFERENCES "payments"("id");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='activities' AND column_name='tx_hash'
  ) THEN
    ALTER TABLE "activities" ADD COLUMN "tx_hash" varchar(128);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='activities' AND column_name='note'
  ) THEN
    ALTER TABLE "activities" ADD COLUMN "note" text;
  END IF;
END$$;

-- Ensure new columns on listings (for services)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='listings' AND column_name='service_type') THEN
    ALTER TABLE "listings" ADD COLUMN "service_type" varchar(32);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='listings' AND column_name='target') THEN
    ALTER TABLE "listings" ADD COLUMN "target" varchar(16);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='listings' AND column_name='service_count') THEN
    ALTER TABLE "listings" ADD COLUMN "service_count" integer;
  END IF;
END$$;

COMMIT;