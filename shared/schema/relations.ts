import { relations } from "drizzle-orm";
import { listings } from "./listings";
import { users } from "./users";
import { payments } from "./payments";
import { disputes } from "./disputes";

export const listingsRelations = relations(listings, ({ one }) => ({
  seller: one(users, { fields: [listings.sellerId], references: [users.id] }),
  buyer: one(users, { fields: [listings.buyerId], references: [users.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  listing: one(listings, { fields: [payments.listingId], references: [listings.id] }),
  buyer: one(users, { fields: [payments.buyerId], references: [users.id] }),
  seller: one(users, { fields: [payments.sellerId], references: [users.id] }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  payment: one(payments, { fields: [disputes.paymentId], references: [payments.id] }),
  buyer: one(users, { fields: [disputes.buyerId], references: [users.id] }),
  seller: one(users, { fields: [disputes.sellerId], references: [users.id] }),
}));