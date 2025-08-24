// server/storage.ts
import { and, ilike, eq, gte, desc, or, sql, lt } from "drizzle-orm";
import {
  users,
  listings,
  activities,
  payments,
  payouts,
  walletLedger,
  walletBalancesView,
} from "@shared/schema";
import { db } from "./db";

/* ---------- Types from Drizzle tables ---------- */
export type User              = typeof users.$inferSelect;
export type InsertUser        = typeof users.$inferInsert;
export type Listing           = typeof listings.$inferSelect;
export type InsertListing     = typeof listings.$inferInsert;
export type Activity          = typeof activities.$inferSelect;
export type InsertActivity    = typeof activities.$inferInsert;
export type Payment           = typeof payments.$inferSelect;
export type InsertPayment     = typeof payments.$inferInsert;
export type Payout            = typeof payouts.$inferSelect;
export type InsertPayout      = typeof payouts.$inferInsert;
export type WalletLedgerRow   = typeof walletLedger.$inferSelect;
export type InsertWalletEntry = typeof walletLedger.$inferInsert;

/* ---------- Contract ---------- */
export interface IStorage {
  // users
  getUser(id: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // listings
  getChannel(id: string): Promise<Listing | undefined>;
  getChannelByUsername(username: string): Promise<Listing | undefined>;
  getChannels(filters?: {
    search?: string;
    kind?: Listing["kind"];
    platform?: Listing["platform"];
    channelMode?: Listing["channelMode"];
    serviceType?: Listing["serviceType"];
    sellerUsername?: string;
    minSubscribers?: number;
    maxPrice?: number;
  }): Promise<Listing[]>;
  createChannel(channel: InsertListing): Promise<Listing>;
  updateChannel(id: string, updates: Partial<Listing>): Promise<Listing | undefined>;
  deleteChannel(id: string): Promise<boolean>;

  // activities
  getActivity(id: string): Promise<Activity | undefined>;
  getActivitiesByUserId(userId: string): Promise<Activity[]>;
  getActivitiesByUserUsername(username: string): Promise<Activity[]>;
  getActivitiesByListing(listingId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: string, updates: Partial<Activity>): Promise<Activity | undefined>;

  // payments
  getPayment(id: string): Promise<Payment | undefined>;
  listPaymentsByBuyerId(buyerId: string): Promise<Payment[]>;
  listPaymentsByBuyerUsername(buyerUsername: string): Promise<Payment[]>;
  listPaymentsByListing(listingId: string): Promise<Payment[]>;
  createPayment(data: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined>;

  // payouts
  getPayout(id: string): Promise<Payout | undefined>;
  listPayoutsBySellerId(sellerId: string): Promise<Payout[]>;
  createPayout(data: InsertPayout): Promise<Payout>;
  updatePayout(id: string, updates: Partial<Payout>): Promise<Payout | undefined>;

  // wallet
  getWalletBalance(userId: string, currency?: string): Promise<{ balance: number; currency: string }>;
  listWalletLedger(
    userId: string,
    opts?: { limit?: number; before?: Date }
  ): Promise<WalletLedgerRow[]>;
  addWalletEntry(entry: InsertWalletEntry): Promise<WalletLedgerRow>;

  // stats
  getMarketplaceStats(): Promise<{ activeListings: number; totalVolume: string; totalSales: number }>;
}

/* ---------- PostgreSQLStorage (Drizzle) ---------- */
class PostgreSQLStorage implements IStorage {
  /* users */
  async getUser(id: string) {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }
  async getUserByTelegramId(telegramId: string) {
    const rows = await db.select().from(users).where(eq(users.telegramId, Number(telegramId))).limit(1);
    return rows[0];
  }
  async getUserByUsername(username: string) {
    if (!username) return undefined;
    const rows = await db.select().from(users).where(ilike(users.username, username)).limit(1);
    return rows[0];
  }
  async createUser(data: InsertUser) {
    const rows = await db.insert(users).values(data).returning();
    return rows[0];
  }
  async updateUser(id: string, updates: Partial<User>) {
    const rows = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return rows[0];
  }

  /* listings */
  async getChannel(id: string) {
    const rows = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    return rows[0];
  }
  async getChannelByUsername(username: string) {
    if (!username) return undefined;
    const handle = username.replace(/^@/, "");
    const rows = await db
      .select()
      .from(listings)
      .where(and(eq(listings.isActive, true), ilike(listings.username, handle)))
      .limit(1);
    return rows[0];
  }
  async getChannels(filters: {
    search?: string;
    kind?: Listing["kind"];
    platform?: Listing["platform"];
    channelMode?: Listing["channelMode"];
    serviceType?: Listing["serviceType"];
    sellerUsername?: string;
    minSubscribers?: number;
    maxPrice?: number;
  } = {}) {
    const conds: any[] = [eq(listings.isActive, true), sql`${listings.deletedAt} IS NULL`];

    if (filters.kind) conds.push(eq(listings.kind, filters.kind));
    if (filters.platform) conds.push(eq(listings.platform, filters.platform));
    if (filters.channelMode) conds.push(eq(listings.channelMode, filters.channelMode));
    if (filters.serviceType) conds.push(eq(listings.serviceType, filters.serviceType));

    if (filters.sellerUsername) {
      const u = await this.getUserByUsername(filters.sellerUsername);
      if (!u) return [];
      conds.push(eq(listings.sellerId, u.id));
    }

    if (filters.search) {
      const s = `%${filters.search}%`;
      conds.push(
        or(
          ilike(listings.title, s),
          ilike(listings.username, s),
          ilike(listings.description, s),
          ilike(listings.platform, s),
        )
      );
    }
    if (filters.minSubscribers != null) {
      conds.push(gte(listings.subscribersCount, Number(filters.minSubscribers)));
    }
    if (filters.maxPrice != null) {
      conds.push(sql`${listings.price}::numeric <= ${Number(filters.maxPrice)}`);
    }

    const where = conds.length > 1 ? and(...conds) : conds[0];
    const rows = await db.select().from(listings).where(where).orderBy(desc(listings.createdAt));
    return rows;
  }
  async createChannel(data: InsertListing) {
    const rows = await db.insert(listings).values(data as any).returning();
    return rows[0];
  }
  async updateChannel(id: string, updates: Partial<Listing>) {
    const rows = await db.update(listings).set(updates as any).where(eq(listings.id, id)).returning();
    return rows[0];
  }
  async deleteChannel(id: string) {
    const rows = await db.delete(listings).where(eq(listings.id, id)).returning({ id: listings.id });
    return !!rows[0];
  }

  /* activities */
  async getActivity(id: string) {
    const rows = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
    return rows[0];
  }
  async getActivitiesByUserId(userId: string) {
    const rows = await db
      .select()
      .from(activities)
      .where(or(eq(activities.buyerId, userId), eq(activities.sellerId, userId)))
      .orderBy(desc(activities.createdAt));
    return rows;
  }
  async getActivitiesByUserUsername(username: string) {
    const u = await this.getUserByUsername(username);
    if (!u) return [];
    return this.getActivitiesByUserId(u.id);
  }
  async getActivitiesByListing(listingId: string) {
    const rows = await db
      .select()
      .from(activities)
      .where(eq(activities.listingId, listingId))
      .orderBy(desc(activities.createdAt));
    return rows;
  }
  async createActivity(data: InsertActivity) {
    const rows = await db.insert(activities).values(data as any).returning();
    return rows[0];
  }
  async updateActivity(id: string, updates: Partial<Activity>) {
    const rows = await db.update(activities).set(updates as any).where(eq(activities.id, id)).returning();
    return rows[0];
  }

  /* payments */
  async getPayment(id: string) {
    const rows = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    return rows[0];
  }
  async listPaymentsByBuyerId(buyerId: string) {
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.buyerId, buyerId))
      .orderBy(desc(payments.createdAt));
    return rows;
  }
  async listPaymentsByBuyerUsername(buyerUsername: string) {
    const u = await this.getUserByUsername(buyerUsername);
    if (!u) return [];
    return this.listPaymentsByBuyerId(u.id);
  }
  async listPaymentsByListing(listingId: string) {
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.listingId, listingId))
      .orderBy(desc(payments.createdAt));
    return rows;
  }
  async createPayment(data: InsertPayment) {
    const rows = await db.insert(payments).values(data as any).returning();
    return rows[0];
  }
  async updatePayment(id: string, updates: Partial<Payment>) {
    const rows = await db.update(payments).set(updates as any).where(eq(payments.id, id)).returning();
    return rows[0];
  }

  /* payouts */
  async getPayout(id: string) {
    const rows = await db.select().from(payouts).where(eq(payouts.id, id)).limit(1);
    return rows[0];
  }
  async listPayoutsBySellerId(sellerId: string) {
    const rows = await db
      .select()
      .from(payouts)
      .where(eq(payouts.sellerId, sellerId))
      .orderBy(desc(payouts.createdAt));
    return rows;
  }
  async createPayout(data: InsertPayout) {
    const rows = await db.insert(payouts).values(data as any).returning();
    return rows[0];
  }
  async updatePayout(id: string, updates: Partial<Payout>) {
    const rows = await db.update(payouts).set(updates as any).where(eq(payouts.id, id)).returning();
    return rows[0];
  }

  /* wallet */
  async getWalletBalance(userId: string, currency = "TON") {
    // نحاول من الفيو أولاً (أسرع)، وإذا ما رجع صف نستخدم تجميع مباشر
    const viewRow = await db.query.walletBalancesView.findFirst({
      where: and(eq(walletBalancesView.userId, userId), eq(walletBalancesView.currency, currency)),
      columns: { balance: true },
    });

    if (viewRow?.balance != null) {
      return { balance: Number(viewRow.balance), currency };
    }

    const agg = await db
      .select({
        bal: sql<number>`COALESCE(SUM(CASE WHEN ${walletLedger.direction} = 'in' THEN ${walletLedger.amount} ELSE -${walletLedger.amount} END), 0)::numeric`,
      })
      .from(walletLedger)
      .where(and(eq(walletLedger.userId, userId), eq(walletLedger.currency, currency)));

    const bal = Number((agg[0] as any)?.bal ?? 0);
    return { balance: bal, currency };
  }

  async listWalletLedger(userId: string, opts?: { limit?: number; before?: Date }) {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const rows = await db
      .select()
      .from(walletLedger)
      .where(
        and(
          eq(walletLedger.userId, userId),
          opts?.before ? lt(walletLedger.createdAt, opts.before) : sql`TRUE`
        )
      )
      .orderBy(desc(walletLedger.createdAt))
      .limit(limit);
    return rows;
  }

  async addWalletEntry(entry: InsertWalletEntry) {
    const rows = await db.insert(walletLedger).values(entry).returning();
    return rows[0];
  }

  /* stats */
  async getMarketplaceStats() {
    const active = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.isActive, true), sql`${listings.deletedAt} IS NULL`));

    const sales = await db
      .select({ amount: activities.amount })
      .from(activities)
      .where(eq(activities.status, "completed"));

    const volume = sales.reduce((s, r) => s + Number(r.amount || 0), 0);
    return { activeListings: active.length, totalVolume: volume.toFixed(2), totalSales: sales.length };
  }
}

/* ---------- Export concrete storage ---------- */
export const storage: IStorage = new PostgreSQLStorage();