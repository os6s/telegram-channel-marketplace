-- 0003_fix_schema_and_seed_admin.sql
-- Bring DB in sync with shared/schema.ts + add useful indexes + seed admin

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

---------------------------
-- users
---------------------------
-- optional wallets
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='ton_wallet') THEN
    ALTER TABLE "users" ADD COLUMN "ton_wallet" varchar(128);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='wallet_address') THEN
    ALTER TABLE "users" ADD COLUMN "wallet_address" varchar(128);
  END IF;
END$$;

-- role with default
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='role') THEN
    ALTER TABLE "users" ADD COLUMN "role" varchar(32) NOT NULL DEFAULT 'user';
  END IF;
END$$;

-- optional unique on telegram_id (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_telegram_id_key'
  ) THEN
    -- try to create a unique index if not already enforced by table constraint
    BEGIN
      CREATE UNIQUE INDEX users_telegram_id_key ON "users" ("telegram_id");
    EXCEPTION WHEN duplicate_table THEN
      -- ignore
    END;
  END IF;
END$$;

-- (optional) case-insensitive unique on username to avoid duplicates
-- comment this block if you expect duplicate usernames
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='users_username_ci_uq'
  ) THEN
    CREATE UNIQUE INDEX users_username_ci_uq ON "users" (lower("username"));
  END IF;
END$$;

---------------------------
-- listings
---------------------------
-- columns already exist per earlier migrations; ensure newer optional columns
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

-- Helpful indexes
CREATE INDEX IF NOT EXISTS listings_seller_idx ON "listings" ("seller_id");
CREATE INDEX IF NOT EXISTS listings_active_created_idx ON "listings" ("is_active", "created_at");
CREATE INDEX IF NOT EXISTS listings_username_ci_idx ON "listings" (lower("username"));

---------------------------
-- payments
---------------------------
-- Bring payments to latest shape (add-only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='payments' AND column_name='kind') THEN
    ALTER TABLE "payments" ADD COLUMN "kind" varchar(16) NOT NULL DEFAULT 'order';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='payments' AND column_name='locked') THEN
    ALTER TABLE "payments" ADD COLUMN "locked" boolean NOT NULL DEFAULT false;
  END IF;

  -- ensure currency column exists & default is TON
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='payments' AND column_name='currency') THEN
    ALTER TABLE "payments" ADD COLUMN "currency" varchar(8) NOT NULL DEFAULT 'TON';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='payments' AND column_name='admin_action') THEN
    ALTER TABLE "payments" ADD COLUMN "admin_action" varchar(16) NOT NULL DEFAULT 'none';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='payments' AND column_name='comment') THEN
    ALTER TABLE "payments" ADD COLUMN "comment" text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='payments' AND column_name='confirmed_at') THEN
    ALTER TABLE "payments" ADD COLUMN "confirmed_at" timestamp;
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS payments_buyer_idx ON "payments" ("buyer_id");
CREATE INDEX IF NOT EXISTS payments_listing_idx ON "payments" ("listing_id");
CREATE INDEX IF NOT EXISTS payments_status_idx ON "payments" ("status");
CREATE INDEX IF NOT EXISTS payments_kind_status_idx ON "payments" ("kind","status");
CREATE INDEX IF NOT EXISTS payments_created_idx ON "payments" ("created_at");

---------------------------
-- payouts
---------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='payouts' AND column_name='currency') THEN
    ALTER TABLE "payouts" ADD COLUMN "currency" varchar(8) NOT NULL DEFAULT 'TON';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='payouts' AND column_name='admin_checked') THEN
    ALTER TABLE "payouts" ADD COLUMN "admin_checked" boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='payouts' AND column_name='checklist') THEN
    ALTER TABLE "payouts" ADD COLUMN "checklist" text;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS payouts_seller_idx ON "payouts" ("seller_id");
CREATE INDEX IF NOT EXISTS payouts_status_idx ON "payouts" ("status");
CREATE INDEX IF NOT EXISTS payouts_created_idx ON "payouts" ("created_at");

---------------------------
-- activities
---------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='activities' AND column_name='tx_hash') THEN
    ALTER TABLE "activities" ADD COLUMN "tx_hash" varchar(128);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='activities' AND column_name='note') THEN
    ALTER TABLE "activities" ADD COLUMN "note" text;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS activities_listing_idx ON "activities" ("listing_id");
CREATE INDEX IF NOT EXISTS activities_buyer_idx ON "activities" ("buyer_id");
CREATE INDEX IF NOT EXISTS activities_seller_idx ON "activities" ("seller_id");
CREATE INDEX IF NOT EXISTS activities_type_created_idx ON "activities" ("type","created_at");

---------------------------
-- disputes / messages
---------------------------
CREATE INDEX IF NOT EXISTS disputes_status_idx ON "disputes" ("status");
CREATE INDEX IF NOT EXISTS messages_dispute_created_idx ON "messages" ("dispute_id","created_at");

---------------------------
-- Seed/ensure admin user (username: os6s7)
---------------------------
-- if a row with this username exists => force role='admin'
-- else insert new row as admin
WITH up AS (
  UPDATE "users"
     SET role = 'admin'
   WHERE lower(coalesce(username,'')) = 'os6s7'
  RETURNING id
)
INSERT INTO "users"(id, telegram_id, username, role, created_at)
SELECT gen_random_uuid(), NULL, 'os6s7', 'admin', now()
WHERE NOT EXISTS (SELECT 1 FROM up)
  AND NOT EXISTS (SELECT 1 FROM "users" WHERE lower(coalesce(username,'')) = 'os6s7');

COMMIT;