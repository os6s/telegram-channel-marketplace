// shared/schema/views.ts
import { pgView, uuid, timestamp, varchar, numeric, boolean, bigint } from "drizzle-orm/pg-core";

/* =========================
   Activities View
========================= */
export const activitiesView = pgView("activities_view", {
  id: uuid("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  type: varchar("type", { length: 32 }),
  status: varchar("status", { length: 32 }),
  amount: numeric("amount", { precision: 18, scale: 8 }),
  currency: varchar("currency", { length: 8 }),
  listingId: uuid("listing_id"),
  buyerId: uuid("buyer_id"),
  sellerId: uuid("seller_id"),
  paymentId: uuid("payment_id"),
  buyerUsername: varchar("buyer_username", { length: 64 }),
  sellerUsername: varchar("seller_username", { length: 64 }),
}).existing();

/* =========================
   Disputes View
========================= */
export const disputesView = pgView("disputes_view", {
  id: uuid("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  status: varchar("status", { length: 32 }),
  paymentId: uuid("payment_id"),
  buyerId: uuid("buyer_id"),
  sellerId: uuid("seller_id"),
  buyerUsername: varchar("buyer_username", { length: 64 }),
  sellerUsername: varchar("seller_username", { length: 64 }),
  reason: varchar("reason", { length: 2048 }),
  evidence: varchar("evidence", { length: 2048 }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}).existing();

/* =========================
   Dispute Messages View
========================= */
export const disputeMessagesView = pgView("dispute_messages_view", {
  id: uuid("id"),
  disputeId: uuid("dispute_id"),
  senderId: uuid("sender_id"),
  senderUsername: varchar("sender_username", { length: 64 }),
  content: varchar("content", { length: 8192 }),
  createdAt: timestamp("created_at", { withTimezone: true }),
}).existing();

/* =========================
   Market Activity View
========================= */
export const marketActivityView = pgView("market_activity", {
  id: uuid("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  kind: varchar("kind", { length: 16 }),
  title: varchar("title", { length: 200 }),
  username: varchar("username", { length: 64 }),
  amount: numeric("amount", { precision: 18, scale: 8 }),
  currency: varchar("currency", { length: 8 }),
  seller: varchar("seller", { length: 64 }),
  buyer: varchar("buyer", { length: 64 }),
}).existing();

/* =========================
   Market Listings View
========================= */
export const marketListingsView = pgView("market_listings", {
  id: uuid("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  platform: varchar("platform", { length: 32 }),
  kind: varchar("kind", { length: 32 }),
  title: varchar("title", { length: 200 }),
  username: varchar("username", { length: 64 }),
  price: numeric("price", { precision: 18, scale: 8 }),
  currency: varchar("currency", { length: 8 }),
  seller: varchar("seller", { length: 64 }),
  isActive: boolean("is_active"),
}).existing();

/* =========================
   Payments View
========================= */
export const paymentsView = pgView("payments_view", {
  id: uuid("id"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  listingId: uuid("listing_id"),
  buyerId: uuid("buyer_id"),
  sellerId: uuid("seller_id"),
  buyerUsername: varchar("buyer_username", { length: 64 }),
  sellerUsername: varchar("seller_username", { length: 64 }),
  amount: numeric("amount", { precision: 18, scale: 8 }),
  currency: varchar("currency", { length: 8 }),
  status: varchar("status", { length: 16 }),
  adminAction: varchar("admin_action", { length: 16 }),
  escrowAddress: varchar("escrow_address", { length: 128 }),
  txHash: varchar("tx_hash", { length: 128 }),
}).existing();

/* =========================
   Wallet Balances View
========================= */
export const walletBalancesView = pgView("wallet_balances", {
  userId: uuid("user_id"),
  username: varchar("username", { length: 64 }),
  balance: numeric("balance", { precision: 18, scale: 8 }),
  txCount: bigint("tx_count", { mode: "number" }),
  lastTx: timestamp("last_tx", { withTimezone: true }),
}).existing();