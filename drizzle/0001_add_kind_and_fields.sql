-- Migration to add missing columns to match drizzle schema

-- Enums
DO $$ BEGIN
    CREATE TYPE listing_kind AS ENUM ('channel', 'username', 'account', 'service');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE platform_kind AS ENUM ('telegram','twitter','instagram','discord','snapchat','tiktok');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE channel_mode AS ENUM ('subscribers','gifts');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE service_type AS ENUM ('followers','members','boost_channel','boost_group');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Users table: add created_at if missing
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP DEFAULT now();

-- Channels table: add missing universal listing fields
ALTER TABLE "channels"
ADD COLUMN IF NOT EXISTS "kind" listing_kind DEFAULT 'channel' NOT NULL,
ADD COLUMN IF NOT EXISTS "platform" platform_kind,
ADD COLUMN IF NOT EXISTS "title" varchar(256),
ADD COLUMN IF NOT EXISTS "currency" varchar(8) DEFAULT 'TON' NOT NULL,
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP DEFAULT now(),
ADD COLUMN IF NOT EXISTS "channel_mode" channel_mode,
ADD COLUMN IF NOT EXISTS "gifts_count" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "gift_kind" varchar(32),
ADD COLUMN IF NOT EXISTS "tg_user_type" varchar(32),
ADD COLUMN IF NOT EXISTS "followers_count" integer,
ADD COLUMN IF NOT EXISTS "account_created_at" varchar(64),
ADD COLUMN IF NOT EXISTS "service_type" service_type,
ADD COLUMN IF NOT EXISTS "target" platform_kind,
ADD COLUMN IF NOT EXISTS "service_count" integer;

-- Activities table: align with drizzle schema
ALTER TABLE "activities"
ADD COLUMN IF NOT EXISTS "act_currency" varchar(8) DEFAULT 'TON' NOT NULL,
ADD COLUMN IF NOT EXISTS "tx_hash" varchar(128),
ALTER COLUMN "completed_at" TYPE TIMESTAMP USING completed_at::timestamp;