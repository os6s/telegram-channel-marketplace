BEGIN;

-- عام
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========== users ==========
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at timestamp,
  ADD COLUMN IF NOT EXISTS ban_reason text;

CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);
CREATE INDEX IF NOT EXISTS users_wallet_idx   ON users(wallet_address);

-- ========== listings ==========
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS seller_username varchar(64),
  ADD COLUMN IF NOT EXISTS buyer_username  varchar(64),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS removed_by_admin boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS removed_reason text;

ALTER TABLE listings
  DROP COLUMN IF EXISTS seller_id,
  DROP COLUMN IF EXISTS is_verified,
  DROP COLUMN IF EXISTS avatar_url;

ALTER TABLE listings
  ALTER COLUMN currency SET DEFAULT 'TON',
  ALTER COLUMN kind     SET NOT NULL,
  ALTER COLUMN price    SET NOT NULL;

CREATE INDEX IF NOT EXISTS listings_seller_username_idx ON listings(seller_username);
CREATE INDEX IF NOT EXISTS listings_buyer_username_idx  ON listings(buyer_username);
CREATE INDEX IF NOT EXISTS listings_active_idx          ON listings(is_active);
CREATE INDEX IF NOT EXISTS listings_created_idx         ON listings(created_at);

-- منع إعلان بدون اسم بائع
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listings_seller_username_chk'
  ) THEN
    ALTER TABLE listings
      ADD CONSTRAINT listings_seller_username_chk
      CHECK (seller_username IS NOT NULL AND seller_username <> '');
  END IF;
END $$;

-- ========== payments ==========
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS seller_username varchar(64),
  ADD COLUMN IF NOT EXISTS buyer_username  varchar(64),
  ADD COLUMN IF NOT EXISTS fee_percent numeric(5,2) DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS fee_amount  numeric(30,9),
  ADD COLUMN IF NOT EXISTS seller_amount numeric(30,9),
  ADD COLUMN IF NOT EXISTS escrow_address varchar(128);

-- حالات وإجراءات مسموحة
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_status_chk') THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_status_chk
      CHECK (status IN ('pending','waiting','paid','completed','disputed','refunded','cancelled'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_admin_action_chk') THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_admin_action_chk
      CHECK (admin_action IN ('none','refund','payout'));
  END IF;
END $$;

-- منع order بدون أسماء طرفين
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_order_usernames_chk') THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_order_usernames_chk
      CHECK (
        kind <> 'order'
        OR (
          buyer_username  IS NOT NULL AND buyer_username  <> '' AND
          seller_username IS NOT NULL AND seller_username <> ''
        )
      );
  END IF;
END $$;

-- tx_hash فريد إن وُجد
CREATE UNIQUE INDEX IF NOT EXISTS payments_tx_hash_uniq ON payments(tx_hash) WHERE tx_hash IS NOT NULL;

-- حساب الرسوم تلقائياً
CREATE OR REPLACE FUNCTION trg_payments_fees() RETURNS trigger AS $$
BEGIN
  IF NEW.fee_percent IS NULL THEN NEW.fee_percent := 5.00; END IF;
  NEW.fee_amount    := ROUND(NEW.amount * (NEW.fee_percent/100.0), 9);
  NEW.seller_amount := ROUND(NEW.amount - NEW.fee_amount, 9);
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_fees_biub ON payments;
CREATE TRIGGER payments_fees_biub
BEFORE INSERT OR UPDATE OF amount, fee_percent ON payments
FOR EACH ROW EXECUTE FUNCTION trg_payments_fees();

CREATE INDEX IF NOT EXISTS payments_buyer_username_idx  ON payments(buyer_username);
CREATE INDEX IF NOT EXISTS payments_seller_username_idx ON payments(seller_username);
CREATE INDEX IF NOT EXISTS payments_status_idx          ON payments(status);
CREATE INDEX IF NOT EXISTS payments_created_idx         ON payments(created_at);

-- ========== activities ==========
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS seller_username varchar(64),
  ADD COLUMN IF NOT EXISTS buyer_username  varchar(64);

CREATE INDEX IF NOT EXISTS activities_seller_username_idx ON activities(seller_username);
CREATE INDEX IF NOT EXISTS activities_buyer_username_idx  ON activities(buyer_username);
CREATE INDEX IF NOT EXISTS activities_type_idx            ON activities(type);
CREATE INDEX IF NOT EXISTS activities_created_idx         ON activities(created_at);

-- تسجيل buy تلقائياً عند إنشاء order
CREATE OR REPLACE FUNCTION trg_act_on_payment_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.kind = 'order' THEN
    INSERT INTO activities (
      listing_id, payment_id, type, status, amount, currency, created_at,
      buyer_username, seller_username
    )
    VALUES (
      NEW.listing_id, NEW.id, 'buy', 'completed', NEW.amount, NEW.currency, now(),
      NEW.buyer_username, NEW.seller_username
    );
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS act_on_payment_insert ON payments;
CREATE TRIGGER act_on_payment_insert
AFTER INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION trg_act_on_payment_insert();

-- ========== منع البيع/الشراء إذا المستخدم ما عنده username أو محظور ==========
CREATE OR REPLACE FUNCTION enforce_user_allowed() RETURNS trigger AS $$
DECLARE v_exists boolean;
BEGIN
  IF TG_TABLE_NAME = 'listings' THEN
    SELECT TRUE INTO v_exists FROM users u
      WHERE u.username = NEW.seller_username
        AND u.username IS NOT NULL AND u.username <> ''
        AND u.is_banned = false
      LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'seller must have a valid username and not be banned';
    END IF;

  ELSIF TG_TABLE_NAME = 'payments' AND NEW.kind = 'order' THEN
    -- seller
    SELECT TRUE INTO v_exists FROM users u
      WHERE u.username = NEW.seller_username
        AND u.username IS NOT NULL AND u.username <> ''
        AND u.is_banned = false
      LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'seller must have a valid username and not be banned';
    END IF;
    -- buyer
    SELECT TRUE INTO v_exists FROM users u
      WHERE u.username = NEW.buyer_username
        AND u.username IS NOT NULL AND u.username <> ''
        AND u.is_banned = false
      LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'buyer must have a valid username and not be banned';
    END IF;
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listings_enforce_allowed ON listings;
CREATE TRIGGER listings_enforce_allowed
BEFORE INSERT OR UPDATE OF seller_username ON listings
FOR EACH ROW EXECUTE FUNCTION enforce_user_allowed();

DROP TRIGGER IF EXISTS payments_enforce_allowed ON payments;
CREATE TRIGGER payments_enforce_allowed
BEFORE INSERT OR UPDATE OF buyer_username, seller_username, kind ON payments
FOR EACH ROW EXECUTE FUNCTION enforce_user_allowed();

-- ========== تسجيل حذف إداري ==========
CREATE OR REPLACE FUNCTION trg_act_on_listing_delete() RETURNS trigger AS $$
BEGIN
  INSERT INTO activities (
    listing_id, type, status, created_at, seller_username
  )
  VALUES (
    OLD.id, 'removed', 'completed', now(), OLD.seller_username
  );
  RETURN OLD;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS act_on_listing_delete ON listings;
CREATE TRIGGER act_on_listing_delete
AFTER DELETE ON listings
FOR EACH ROW EXECUTE FUNCTION trg_act_on_listing_delete();

COMMIT;