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
  type Listing as Channel,            // نستخدم Listing كـ Channel
  type InsertListing as InsertChannel, // و InsertListing كـ InsertChannel
  type Activity,
  type InsertActivity,
  type Payment,
  type InsertPayment,
  type Payout,
  type InsertPayout,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";

/* ---------- Contract ---------- */
export interface IStorage {
  // users
  getUser(id: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // listings/channels
  getChannel(id: string): Promise<Channel | undefined>;
  getChannelByUsername(username: string): Promise<Channel | undefined>;
  getChannels(filters?: {
    category?: string;
    minSubscribers?: number;
    maxPrice?: string;
    search?: string;
    sellerId?: string;
  }): Promise<Channel[]>;
  createChannel(channel: InsertChannel & { sellerId: string }): Promise<Channel>;
  updateChannel(id: string, updates: Partial<Channel>): Promise<Channel | undefined>;
  deleteChannel(id: string): Promise<boolean>;

  // activities
  getActivity(id: string): Promise<Activity | undefined>;
  getActivitiesByUser(userId: string): Promise<Activity[]>;
  getActivitiesByChannel(channelId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: string, updates: Partial<Activity>): Promise<Activity | undefined>;

  // payments (escrow)
  getPayment(id: string): Promise<Payment | undefined>;
  listPaymentsByBuyer(buyerId: string): Promise<Payment[]>;
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

/* ---------- MemStorage (اختباري) ---------- */
export class MemStorage implements IStorage {
  private _users = new Map<string, User>();
  private _listings = new Map<string, Channel>();
  private _acts = new Map<string, Activity>();
  private _pays = new Map<string, Payment>();
  private _pouts = new Map<string, Payout>();

  // users
  async getUser(id: string) { return this._users.get(id); }
  async getUserByTelegramId(telegramId: string) {
    return Array.from(this._users.values()).find((u) => u.telegramId === telegramId);
  }
  async createUser(data: InsertUser) {
    const id = randomUUID();
    const user: User = { id, role: "user", createdAt: new Date() as any, ...data } as any;
    this._users.set(id, user);
    return user;
  }
  async updateUser(id: string, updates: Partial<User>) {
    const cur = this._users.get(id); if (!cur) return undefined;
    const next = { ...cur, ...updates }; this._users.set(id, next); return next;
  }

  // listings
  async getChannel(id: string) { return this._listings.get(id); }
  async getChannelByUsername(username: string) {
    const u = String(username || "").toLowerCase();
    return Array.from(this._listings.values()).find((c) => (c.username ?? "").toLowerCase() === u);
  }
  async getChannels(filters: {
    category?: string; minSubscribers?: number; maxPrice?: string; search?: string; sellerId?: string;
  } = {}) {
    let rows = Array.from(this._listings.values()).filter((c: any) => c.isActive);

    if (filters.sellerId) rows = rows.filter((c) => c.sellerId === filters.sellerId);
    if (filters.category) rows = rows.filter((c: any) => (c as any).category === filters.category);
    if (filters.search) {
      const s = String(filters.search).toLowerCase();
      rows = rows.filter((c) =>
        [c.title, c.username, c.description].some((v: any) => (v ?? "").toLowerCase().includes(s))
      );
    }
    if (filters.minSubscribers != null) {
      rows = rows.filter((c: any) => Number((c as any).subscribersCount || 0) >= Number(filters.minSubscribers));
    }
    if (filters.maxPrice) {
      rows = rows.filter((c: any) => Number(c.price) <= Number(filters.maxPrice));
    }

    return rows.sort((a: any, b: any) =>
      new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
    );
  }
  async createChannel(data: InsertChannel & { sellerId: string }) {
    const id = randomUUID();
    const row: Channel = { id, isVerified: false, isActive: true, createdAt: new Date() as any, ...data } as any;
    this._listings.set(id, row);
    return row;
  }
  async updateChannel(id: string, updates: Partial<Channel>) {
    const cur = this._listings.get(id); if (!cur) return undefined;
    const next = { ...cur, ...updates }; this._listings.set(id, next); return next;
  }
  async deleteChannel(id: string) { return this._listings.delete(id); }

  // activities
  async getActivity(id: string) { return this._acts.get(id); }
  async getActivitiesByUser(userId: string) {
    return Array.from(this._acts.values()).filter((a) => a.buyerId === userId || a.sellerId === userId);
  }
  async getActivitiesByChannel(channelId: string) {
    return Array.from(this._acts.values()).filter((a: any) => a.listingId === channelId);
  }
  async createActivity(data: InsertActivity) {
    const id = randomUUID();
    const act: Activity = { id, createdAt: new Date() as any, status: "completed", ...data } as any;
    this._acts.set(id, act); return act;
  }
  async updateActivity(id: string, updates: Partial<Activity>) {
    const cur = this._acts.get(id); if (!cur) return undefined;
    const next = { ...cur, ...updates }; this._acts.set(id, next); return next;
  }

  // payments
  async getPayment(id: string) { return this._pays.get(id); }
  async listPaymentsByBuyer(buyerId: string) {
    return Array.from(this._pays.values()).filter((p) => p.buyerId === buyerId);
  }
  async listPaymentsByListing(listingId: string) {
    return Array.from(this._pays.values()).filter((p) => p.listingId === listingId);
  }
  async createPayment(data: InsertPayment) {
    const id = randomUUID();
    const now = new Date() as any;
    const pay: Payment = {
      id,
      createdAt: now,
      status: "pending",
      feeAmount: "0" as any,      // احسبها في الراوتر قبل الإدخال
      sellerAmount: "0" as any,   // احسبها في الراوتر قبل الإدخال
      buyerConfirmed: false as any,
      sellerConfirmed: false as any,
      adminAction: "none" as any,
      ...data,
    } as any;
    this._pays.set(id, pay);
    return pay;
  }
  async updatePayment(id: string, updates: Partial<Payment>) {
    const cur = this._pays.get(id); if (!cur) return undefined;
    const next = { ...cur, ...updates } as Payment;
    this._pays.set(id, next); return next;
  }

  // payouts
  async getPayout(id: string) { return this._pouts.get(id); }
  async listPayoutsBySeller(sellerId: string) {
    return Array.from(this._pouts.values()).filter((p) => p.sellerId === sellerId);
  }
  async createPayout(data: InsertPayout) {
    const id = randomUUID();
    const p: Payout = { id, status: "queued" as any, createdAt: new Date() as any, ...data } as any;
    this._pouts.set(id, p); return p;
  }
  async updatePayout(id: string, updates: Partial<Payout>) {
    const cur = this._pouts.get(id); if (!cur) return undefined;
    const next = { ...cur, ...updates } as Payout;
    this._pouts.set(id, next); return next;
  }

  async getMarketplaceStats() {
    const active = Array.from(this._listings.values()).filter((c: any) => c.isActive).length;
    const completed = Array.from(this._acts.values()).filter((a) => a.status === "completed");
    const volume = completed.reduce((s, a: any) => s + Number(a.amount || 0), 0);
    return { activeListings: active, totalVolume: volume.toFixed(2), totalSales: completed.length };
  }
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
    return rows[0] as Channel | undefined;
  }
  async getChannelByUsername(username: string) {
    if (!username) return undefined;
    const u = username.toLowerCase();
    const rows = await db
      .select()
      .from(listings)
      .where(eq(sql`lower(${listings.username})`, u))
      .limit(1);
    return rows[0] as Channel | undefined;
  }
  async getChannels(filters: {
    category?: string; minSubscribers?: number; maxPrice?: string; search?: string; sellerId?: string;
  } = {}) {
    const conds: any[] = [eq(listings.isActive, true)];

    if (filters.sellerId) conds.push(eq(listings.sellerId, filters.sellerId));
    if (filters.category) conds.push(eq((listings as any).category, filters.category));

    if (filters.search) {
      const s = `%${filters.search}%`;
      conds.push(
        or(
          ilike(listings.title, s),
          ilike(listings.username, s),
          ilike(listings.description, s),
        )
      );
    }

    if (filters.minSubscribers != null) {
      conds.push(gte((listings as any).subscribersCount, filters.minSubscribers));
    }

    if (filters.maxPrice) {
      conds.push(sql`(${listings.price})::numeric <= ${Number(filters.maxPrice)}`);
    }

    const where = conds.length > 1 ? and(...conds) : conds[0];
    const rows = await db.select().from(listings).where(where).orderBy(desc(listings.createdAt));
    return rows as Channel[];
  }
  async createChannel(data: InsertChannel & { sellerId: string }) {
    const rows = await db.insert(listings).values(data as any).returning();
    return rows[0] as Channel;
  }
  async updateChannel(id: string, updates: Partial<Channel>) {
    const rows = await db.update(listings).set(updates as any).where(eq(listings.id, id)).returning();
    return rows[0] as Channel;
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
  async getActivitiesByUser(userId: string) {
    const rows = await db
      .select()
      .from(activities)
      .where(or(eq(activities.buyerId, userId), eq(activities.sellerId, userId)));
    return rows as Activity[];
  }
  async getActivitiesByChannel(channelId: string) {
    const rows = await db.select().from(activities).where(eq(activities.listingId, channelId));
    return rows as Activity[];
  }
  async createActivity(data: InsertActivity) {
    // تأكيد وتوريث من الـ listing
    const listing = await this.getChannel((data as any).listingId);
    if (!listing || !listing.isActive) throw new Error("Listing not found or inactive");

    const amountFromListing = Number(String(listing.price).replace(",", "."));
    const amountIncoming = Number(String((data as any).amount ?? listing.price).replace(",", "."));
    if (Number.isFinite(amountIncoming) && amountIncoming !== amountFromListing) {
      throw new Error("Amount does not match listing price");
    }

    const payload: InsertActivity = {
      ...data,
      sellerId: (data as any).sellerId ?? listing.sellerId,
      amount: String(amountFromListing),
      currency: (data as any).currency ?? (listing as any).currency ?? "TON",
    } as InsertActivity;

    const rows = await db.insert(activities).values(payload).returning();
    return rows[0];
  }
  async updateActivity(id: string, updates: Partial<Activity>) {
    const rows = await db.update(activities).set(updates).where(eq(activities.id, id)).returning();
    return rows[0];
  }

  /* payments */
  async getPayment(id: string) {
    const rows = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    return rows[0];
  }
  async listPaymentsByBuyer(buyerId: string) {
    const rows = await db.select().from(payments).where(eq(payments.buyerId, buyerId)).orderBy(desc(payments.createdAt));
    return rows as Payment[];
  }
  async listPaymentsByListing(listingId: string) {
    const rows = await db.select().from(payments).where(eq(payments.listingId, listingId)).orderBy(desc(payments.createdAt));
    return rows as Payment[];
  }
  async createPayment(data: InsertPayment) {
    const rows = await db.insert(payments).values(data as any).returning();
    return rows[0] as Payment;
  }
  async updatePayment(id: string, updates: Partial<Payment>) {
    const rows = await db.update(payments).set(updates as any).where(eq(payments.id, id)).returning();
    return rows[0] as Payment;
  }

  /* payouts */
  async getPayout(id: string) {
    const rows = await db.select().from(payouts).where(eq(payouts.id, id)).limit(1);
    return rows[0];
  }
  async listPayoutsBySeller(sellerId: string) {
    const rows = await db.select().from(payouts).where(eq(payouts.sellerId, sellerId)).orderBy(desc(payouts.createdAt));
    return rows as Payout[];
  }
  async createPayout(data: InsertPayout) {
    const rows = await db.insert(payouts).values(data as any).returning();
    return rows[0] as Payout;
  }
  async updatePayout(id: string, updates: Partial<Payout>) {
    const rows = await db.update(payouts).set(updates as any).where(eq(payouts.id, id)).returning();
    return rows[0] as Payout;
  }

  async getMarketplaceStats() {
    const active = await db.select({ id: listings.id }).from(listings).where(eq(listings.isActive, true));
    const sales  = await db.select().from(activities).where(eq(activities.status, "completed"));
    const volume = (sales as any[]).reduce((sum, a) => sum + Number(String((a as any).amount || 0)), 0);
    return { activeListings: active.length, totalVolume: volume.toFixed(2), totalSales: sales.length };
  }
}

/* ---------- Export concrete storage ---------- */
export const storage: IStorage =
  process.env.DATABASE_URL ? new PostgreSQLStorage() : new MemStorage();

console.log(`Using ${process.env.DATABASE_URL ? "PostgreSQL" : "in-memory"} storage`);