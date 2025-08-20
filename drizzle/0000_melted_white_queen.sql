CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"payment_id" uuid,
	"type" varchar(24) NOT NULL,
	"status" varchar(16) DEFAULT 'completed' NOT NULL,
	"amount" numeric(30, 9),
	"currency" varchar(8),
	"tx_hash" varchar(128),
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"reason" text,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"evidence" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"kind" varchar(16) NOT NULL,
	"platform" varchar(16),
	"username" varchar(64),
	"title" varchar(256),
	"description" text,
	"price" numeric(30, 9) NOT NULL,
	"currency" varchar(8) DEFAULT 'TON' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"avatar_url" text,
	"channel_mode" varchar(16),
	"subscribers_count" integer,
	"gifts_count" integer,
	"gift_kind" varchar(64),
	"tg_user_type" varchar(64),
	"followers_count" integer,
	"account_created_at" varchar(7),
	"service_type" varchar(32),
	"target" varchar(16),
	"service_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid,
	"buyer_id" uuid NOT NULL,
	"kind" varchar(16) DEFAULT 'order' NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"amount" numeric(30, 9) NOT NULL,
	"currency" varchar(8) DEFAULT 'TON' NOT NULL,
	"fee_percent" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"fee_amount" numeric(30, 9) NOT NULL,
	"seller_amount" numeric(30, 9) NOT NULL,
	"escrow_address" varchar(128) NOT NULL,
	"tx_hash" varchar(128),
	"buyer_confirmed" boolean DEFAULT false NOT NULL,
	"seller_confirmed" boolean DEFAULT false NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"admin_action" varchar(16) DEFAULT 'none' NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid,
	"seller_id" uuid NOT NULL,
	"to_address" varchar(128) NOT NULL,
	"amount" numeric(30, 9) NOT NULL,
	"currency" varchar(8) DEFAULT 'TON' NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"tx_hash" varchar(128),
	"note" text,
	"admin_checked" boolean DEFAULT false NOT NULL,
	"checklist" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"confirmed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" varchar(64),
	"username" varchar(64),
	"first_name" varchar(128),
	"last_name" varchar(128),
	"ton_wallet" varchar(128),
	"wallet_address" varchar(128),
	"role" varchar(32) DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_listing_idx" ON "activities" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "activities_buyer_idx" ON "activities" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "activities_seller_idx" ON "activities" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "activities_type_idx" ON "activities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "activities_created_idx" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "disputes_payment_idx" ON "disputes" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "disputes_buyer_idx" ON "disputes" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "disputes_seller_idx" ON "disputes" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "disputes_created_idx" ON "disputes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "listings_seller_idx" ON "listings" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "listings_active_idx" ON "listings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "listings_platform_idx" ON "listings" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "listings_username_idx" ON "listings" USING btree ("username");--> statement-breakpoint
CREATE INDEX "listings_created_idx" ON "listings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "messages_dispute_idx" ON "messages" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "messages_created_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payments_buyer_idx" ON "payments" USING btree ("buyer_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_listing_idx" ON "payments" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_kind_idx" ON "payments" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_tx_idx" ON "payments" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "payments_created_idx" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payouts_seller_idx" ON "payouts" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payouts_payment_idx" ON "payouts" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payouts_created_idx" ON "payouts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_telegram_idx" ON "users" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_wallet_idx" ON "users" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "users_created_idx" ON "users" USING btree ("created_at");