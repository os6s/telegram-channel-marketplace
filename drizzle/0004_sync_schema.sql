-- =============================
-- Sync DB schema with shared/schema.ts
-- Safe/idempotent where possible
-- =============================

-- ===== listings =====
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS account_created_at varchar(7),
  ADD COLUMN IF NOT EXISTS service_count integer;

-- created_at -> timestamptz
ALTER TABLE listings
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- helpful indexes
CREATE INDEX IF NOT EXISTS listings_seller_idx   ON listings (seller_id);
CREATE INDEX IF NOT EXISTS listings_active_idx   ON listings (is_active);
CREATE INDEX IF NOT EXISTS listings_platform_idx ON listings (platform);
CREATE INDEX IF NOT EXISTS listings_username_idx ON listings (username);
CREATE INDEX IF NOT EXISTS listings_created_idx  ON listings (created_at);

-- ===== users =====
ALTER TABLE users
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

CREATE INDEX IF NOT EXISTS users_telegram_idx ON users (telegram_id);
CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);
CREATE INDEX IF NOT EXISTS users_wallet_idx   ON users (wallet_address);
CREATE INDEX IF NOT EXISTS users_created_idx  ON users (created_at);

-- ===== payments =====
-- add missing columns
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS kind varchar(16) NOT NULL DEFAULT 'order',
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS currency varchar(8) NOT NULL DEFAULT 'TON',
  ADD COLUMN IF NOT EXISTS fee_percent numeric(5,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS fee_amount numeric(30,9),
  ADD COLUMN IF NOT EXISTS seller_amount numeric(30,9),
  ADD COLUMN IF NOT EXISTS buyer_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS admin_action varchar(16) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- escrow address & tx hash might be missing on old rows
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS escrow_address varchar(128),
  ADD COLUMN IF NOT EXISTS tx_hash varchar(128);

-- backfill fee_amount / seller_amount if null
UPDATE payments p
SET
  fee_amount = COALESCE(p.fee_amount, (p.amount * p.fee_percent/100.0)),
  seller_amount = COALESCE(p.seller_amount, (p.amount - COALESCE(p.fee_amount, (p.amount * p.fee_percent/100.0))))
WHERE p.amount IS NOT NULL;

-- enforce NOT NULL after backfill
ALTER TABLE payments
  ALTER COLUMN fee_amount SET NOT NULL,
  ALTER COLUMN seller_amount SET NOT NULL;

-- timestamps to timestamptz
ALTER TABLE payments
  ALTER COLUMN created_at TYPE timestamptz USING created_at,
  ALTER COLUMN confirmed_at TYPE timestamptz USING confirmed_at;

-- indexes
CREATE INDEX IF NOT EXISTS payments_buyer_idx   ON payments (buyer_id, created_at);
CREATE INDEX IF NOT EXISTS payments_listing_idx ON payments (listing_id, created_at);
CREATE INDEX IF NOT EXISTS payments_kind_idx    ON payments (kind);
CREATE INDEX IF NOT EXISTS payments_status_idx  ON payments (status);
CREATE INDEX IF NOT EXISTS payments_tx_idx      ON payments (tx_hash);
CREATE INDEX IF NOT EXISTS payments_created_idx ON payments (created_at);

-- ===== payouts =====
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS currency varchar(8) NOT NULL DEFAULT 'TON',
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS admin_checked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- timestamps to timestamptz
ALTER TABLE payouts
  ALTER COLUMN created_at TYPE timestamptz USING created_at,
  ALTER COLUMN sent_at TYPE timestamptz USING sent_at,
  ALTER COLUMN confirmed_at TYPE timestamptz USING confirmed_at;

CREATE INDEX IF NOT EXISTS payouts_seller_idx   ON payouts (seller_id);
CREATE INDEX IF NOT EXISTS payouts_status_idx   ON payouts (status);
CREATE INDEX IF NOT EXISTS payouts_payment_idx  ON payouts (payment_id);
CREATE INDEX IF NOT EXISTS payouts_created_idx  ON payouts (created_at);

-- ===== activities =====
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS currency varchar(8),
  ADD COLUMN IF NOT EXISTS tx_hash varchar(128);

ALTER TABLE activities
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

CREATE INDEX IF NOT EXISTS activities_listing_idx ON activities (listing_id);
CREATE INDEX IF NOT EXISTS activities_buyer_idx   ON activities (buyer_id);
CREATE INDEX IF NOT EXISTS activities_seller_idx  ON activities (seller_id);
CREATE INDEX IF NOT EXISTS activities_type_idx    ON activities (type);
CREATE INDEX IF NOT EXISTS activities_created_idx ON activities (created_at);

-- ===== disputes =====
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS evidence text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE disputes
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN resolved_at TYPE timestamptz USING resolved_at;

CREATE INDEX IF NOT EXISTS disputes_payment_idx ON disputes (payment_id);
CREATE INDEX IF NOT EXISTS disputes_buyer_idx   ON disputes (buyer_id);
CREATE INDEX IF NOT EXISTS disputes_seller_idx  ON disputes (seller_id);
CREATE INDEX IF NOT EXISTS disputes_status_idx  ON disputes (status);
CREATE INDEX IF NOT EXISTS disputes_created_idx ON disputes (created_at);

-- ===== messages =====
ALTER TABLE messages
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

CREATE INDEX IF NOT EXISTS messages_dispute_idx ON messages (dispute_id);
CREATE INDEX IF NOT EXISTS messages_sender_idx  ON messages (sender_id);
CREATE INDEX IF NOT EXISTS messages_created_idx ON messages (created_at);