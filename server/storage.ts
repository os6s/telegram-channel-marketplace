// server/storage.ts
import { and, ilike, eq, gte, desc, or, sql } from "drizzle-orm";
import {
  users,
  listings,
  activities,
  payments,
  payouts,
  type User,
  type InsertUser,
  type Listing,
  type InsertListing,
  type Activity,
  type InsertActivity,
  type Payment,
  type InsertPayment,
  type Payout,
  type InsertPayout,
} from "@shared/schema";
import { db } from "./db";

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
  getActivitiesByUserUsername(username: string): Promise<Activity[]>;
  getActivitiesByListing(listingId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: string, updates: Partial<Activity>): Promise<Activity | undefined>;

  // payments
  getPayment(id: string): Promise<Payment | undefined>;
  listPaymentsByBuyerUsername(buyerUsername: string): Promise<Payment[]>;
  listPaymentsByListing(listingId: string): Promise<Payment[]>;
  createPayment(data: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined>;

  // payouts
  getPayout(id: string): Promise<Payout | undefined>;
  listPayoutsBySeller(sellerId: string): Promise<Payout[]>;
  createPayout(data: InsertPayout): Promise<Payout>;
  updatePayout(id: string, updates: Partial<Payout>): Promise<Payout | undefined>;

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
    const rows = await db.select().from(users).where(eq(users.telegramId, String(telegramId))).limit(1);
    return rows[0];
  }
  async getUserByUsername(username: string) {
    if (!username) return undefined;
    const u = username.toLowerCase();
    const rows = await db.select().from(users).where(eq(sql`lower(${users.username})`, u)).limit(1);
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
    const u = username.toLowerCase();
    const rows = await db
      .select()
      .from(listings)
      .where(and(eq(listings.isActive, true), eq(sql`lower(${listings.username})`, u)))
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
    const conds: any[] = [eq(listings.isActive, true)];

    if (filters.kind) conds.push(eq(listings.kind, filters.kind));
    if (filters.platform) conds.push(eq(listings.platform, filters.platform));
    if (filters.channelMode) conds.push(eq(listings.channelMode, filters.channelMode));
    if (filters.serviceType) conds.push(eq(listings.serviceType, filters.serviceType));
    if (filters.sellerUsername) {
      const u = filters.sellerUsername.toLowerCase();
      conds.push(eq(sql`lower(${listings.sellerUsername})`, u));
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
  async getActivitiesByUserUsername(username: string) {
    const u = username.toLowerCase();
    const rows = await db
      .select()
      .from(activities)
      .where(
        or(
          eq(sql`lower(${activities.buyerUsername})`, u),
          eq(sql`lower(${activities.sellerUsername})`, u)
        )
      )
      .orderBy(desc(activities.createdAt));
    return rows;
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
  async listPaymentsByBuyerUsername(buyerUsername: string) {
    const u = buyerUsername.toLowerCase();
    const rows = await db
      .select()
      .from(payments)
      .where(eq(sql`lower(${payments.buyerUsername})`, u))
      .orderBy(desc(payments.createdAt));
    return rows;
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
  async listPayoutsBySeller(sellerId: string) {
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

  /* stats */
  async getMarketplaceStats() {
    const active = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.isActive, true));

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