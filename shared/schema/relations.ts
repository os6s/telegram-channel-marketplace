// shared/schema/relations.ts
import { relations } from "drizzle-orm";
import { listings } from "./listings";
import { users } from "./users";
import { payments } from "./payments";
import { disputes, messages } from "./disputes";
import { activities } from "./activities";
import { walletLedger } from "./wallet";

// Listings ↔ Users
export const listingsRelations = relations(listings, ({ one }) => ({
  seller: one(users, { fields: [listings.sellerId], references: [users.id] }),
  buyer: one(users, { fields: [listings.buyerId], references: [users.id] }),
}));

// Payments ↔ Listings ↔ Users
export const paymentsRelations = relations(payments, ({ one }) => ({
  listing: one(listings, { fields: [payments.listingId], references: [listings.id] }),
  buyer: one(users, { fields: [payments.buyerId], references: [users.id] }),
  seller: one(users, { fields: [payments.sellerId], references: [users.id] }),
}));

// Disputes ↔ Payments ↔ Users
export const disputesRelations = relations(disputes, ({ one }) => ({
  payment: one(payments, { fields: [disputes.paymentId], references: [payments.id] }),
  buyer: one(users, { fields: [disputes.buyerId], references: [users.id] }),
  seller: one(users, { fields: [disputes.sellerId], references: [users.id] }),
}));

// Activities ↔ Listings/Payments/Users
export const activitiesRelations = relations(activities, ({ one }) => ({
  listing: one(listings, { fields: [activities.listingId], references: [listings.id] }),
  payment: one(payments, { fields: [activities.paymentId], references: [payments.id] }),
  buyer: one(users, { fields: [activities.buyerId], references: [users.id] }),
  seller: one(users, { fields: [activities.sellerId], references: [users.id] }),
}));

// Dispute Messages ↔ Disputes ↔ Users
export const disputeMessagesRelations = relations(messages, ({ one }) => ({
  dispute: one(disputes, { fields: [messages.disputeId], references: [disputes.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

// Wallet Ledger ↔ Users
export const walletLedgerRelations = relations(walletLedger, ({ one }) => ({
  user: one(users, { fields: [walletLedger.userId], references: [users.id] }),
}));