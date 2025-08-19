// server/storage.ts
import { and, ilike, eq, gte, lte, desc } from "drizzle-orm";
import {
  users,
  listings,
  activities,
  type User,
  type Listing as Channel,           // ← نستخدم Listing كـ Channel
  type InsertListing as InsertChannel, // ← و InsertListing كـ InsertChannel
  type Activity,
  type InsertActivity,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";

/* ---------- Contract ---------- */
export interface IStorage {
  // users
  getUser(id: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: Partial<User>): Promise<User>;
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

  // stats
  getMarketplaceStats(): Promise<{ activeListings: number; totalVolume: string; totalSales: number }>;
}

/* ---------- MemStorage (اختباري) ---------- */
export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private channels = new Map<string, Channel>();
  private acts = new Map<string, Activity>();

  async getUser(id: string) { return this.users.get(id); }
  async getUserByTelegramId(telegramId: string) {
    return Array.from(this.users.values()).find((u) => u.telegramId === telegramId);
  }
  async createUser(data: Partial<User>) {
    const id = randomUUID();
    const user: User = { id, role: "user", createdAt: new Date() as any, ...data } as any;
    this.users.set(id, user);
    return user;
  }
  async updateUser(id: string, updates: Partial<User>) {
    const cur = this.users.get(id); if (!cur) return undefined;
    const next = { ...cur, ...updates };
    this.users.set(id, next); return next;
  }

  async getChannel(id: string) { return this.channels.get(id); }
  async getChannelByUsername(username: string) {
    const u = String(username || "").toLowerCase();
    return Array.from(this.channels.values()).find((c) => (c.username ?? "").toLowerCase() === u);
  }
  async getChannels(filters: any = {}) {
    let result = Array.from(this.channels.values()).filter((c: any) => c.isActive);
    if (filters.category) result = result.filter((c: any) => (c.category ?? null) === filters.category);
    if (filters.minSubscribers != null) result = result.filter((c: any) => (c.subscribersCount ?? 0) >= filters.minSubscribers!);
    if (filters.maxPrice) result = result.filter((c: any) => Number(c.price) <= Number(filters.maxPrice!));
    if (filters.search) {
      const s = String(filters.search).toLowerCase();
      result = result.filter((c: any) =>
        [c.title, c.username, c.description].some((v: any) => (v ?? "").toLowerCase().includes(s))
      );
    }
    if (filters.sellerId) result = result.filter((c: any) => c.sellerId === filters.sellerId);
    return result.sort((a: any, b: any) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());
  }
  async createChannel(data: InsertChannel & { sellerId: string }) {
    const id = randomUUID();
    const row: Channel = { id, isVerified: false, isActive: true, createdAt: new Date() as any, ...data } as any;
    this.channels.set(id, row); return row;
  }
  async updateChannel(id: string, updates: Partial<Channel>) {
    const cur = this.channels.get(id); if (!cur) return undefined;
    const next = { ...cur, ...updates }; this.channels.set(id, next); return next;
  }
  async deleteChannel(id: string) { return this.channels.delete(id); }

  async getActivity(id: string) { return this.acts.get(id); }
  async getActivitiesByUser(userId: string) {
    return Array.from(this.acts.values()).filter((a) => a.buyerId === userId || a.sellerId === userId);
  }
  async getActivitiesByChannel(channelId: string) {
    return Array.from(this.acts.values()).filter((a: any) => a.listingId === channelId);
  }
  async createActivity(data: InsertActivity) {
    const id = randomUUID();
    const act: Activity = { id, createdAt: new Date() as any, status: "completed", ...data } as any;
    this.acts.set(id, act); return act;
  }
  async updateActivity(id: string, updates: Partial<Activity>) {
    const cur = this.acts.get(id); if (!cur) return undefined;
    const next = { ...cur, ...updates }; this.acts.set(id, next); return next;
  }
  async getMarketplaceStats() {
    const active = Array.from(this.channels.values()).filter((c: any) => c.isActive).length;
    const completed = Array.from(this.acts.values()).filter((a) => a.status === "completed");
    const volume = completed.reduce((s, a: any) => s + Number(a.amount || 0), 0);
    return { activeListings: active, totalVolume: volume.toFixed(2), totalSales: completed.length };
  }
}

/* ---------- PostgreSQLStorage (Drizzle) ---------- */
class PostgreSQLStorage implements IStorage {
  // users
  async getUser(id: string) {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1); return rows[0];
  }
  async getUserByTelegramId(telegramId: string) {
    const rows = await db.select().from(users).where(eq(users.telegramId, String(telegramId))).limit(1); return rows[0];
  }
  async createUser(data: Partial<User>) {
    const rows = await db.insert(users).values(data as any).returning(); return rows[0];
  }
  async updateUser(id: string, updates: Partial<User>) {
    const rows = await db.update(users).set(updates).where(eq(users.id, id)).returning(); return rows[0];
  }

  // listings
  async getChannel(id: string) {
    const rows = await db.select().from(listings).where(eq(listings.id, id)).limit(1); return rows[0];
  }
  async getChannelByUsername(username: string) {
    if (!username) return undefined;
    const rows = await db.select().from(listings).where(eq(listings.username, username)).limit(1); return rows[0];
  }
  async getChannels(filters: {
    category?: string; minSubscribers?: number; maxPrice?: string; search?: string; sellerId?: string;
  } = {}) {
    const conds: any[] = [eq(listings.isActive, true)];
    if (filters.category) conds.push(eq((listings as any).category, filters.category)); // إن وُجدت
    if (filters.sellerId) conds.push(eq(listings.sellerId, filters.sellerId));
    if (filters.search)  conds.push(ilike(listings.title, `%${filters.search}%`));
    if (filters.minSubscribers != null) conds.push(gte((listings as any).subscribersCount, filters.minSubscribers));
    if (filters.maxPrice) conds.push(lte(listings.price, filters.maxPrice as any));

    const where = conds.length > 1 ? and(...conds) : conds[0];
    const rows = await db.select().from(listings).where(where).orderBy(desc(listings.createdAt));
    return rows as Channel[];
  }
  async createChannel(data: InsertChannel & { sellerId: string }) {
    const rows = await db.insert(listings).values(data as any).returning(); return rows[0] as Channel;
  }
  async updateChannel(id: string, updates: Partial<Channel>) {
    const rows = await db.update(listings).set(updates as any).where(eq(listings.id, id)).returning();
    return rows[0] as Channel;
  }
  async deleteChannel(id: string) {
    const rows = await db.delete(listings).where(eq(listings.id, id)).returning({ id: listings.id }); return !!rows[0];
  }

  // activities
  async getActivity(id: string) {
    const rows = await db.select().from(activities).where(eq(activities.id, id)).limit(1); return rows[0];
  }
  async getActivitiesByUser(userId: string) {
    const rows = await db.select().from(activities)
      .where(and(eq(activities.buyerId, userId))) as Activity[]; // ممكن تضيف OR للبائع حسب حاجتك
    return rows;
  }
  async getActivitiesByChannel(channelId: string) {
    const rows = await db.select().from(activities).where(eq(activities.listingId, channelId)); return rows;
  }
  async createActivity(data: InsertActivity) {
    const rows = await db.insert(activities).values(data).returning(); return rows[0];
  }
  async updateActivity(id: string, updates: Partial<Activity>) {
    const rows = await db.update(activities).set(updates).where(eq(activities.id, id)).returning(); return rows[0];
  }

  async getMarketplaceStats() {
    const active = await db.select({ id: listings.id }).from(listings).where(eq(listings.isActive, true));
    const sales  = await db.select().from(activities).where(eq(activities.status, "completed"));
    const volume = (sales as any[]).reduce((sum, a) => sum + Number(a.amount || 0), 0);
    return { activeListings: active.length, totalVolume: volume.toFixed(2), totalSales: sales.length };
  }
}

/* ---------- Export concrete storage ---------- */
export const storage: IStorage =
  process.env.DATABASE_URL ? new PostgreSQLStorage() : new MemStorage();

console.log(`Using ${process.env.DATABASE_URL ? "PostgreSQL" : "in-memory"} storage`);
