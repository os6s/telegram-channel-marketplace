// server/storage.ts
import { and, ilike, eq } from "drizzle-orm";
import {
  users,
  channels,
  activities,
  type User,
  type InsertUser,
  type Channel,
  type InsertChannel,
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

  // stats
  getMarketplaceStats(): Promise<{
    activeListings: number;
    totalVolume: string;
    totalSales: number;
  }>;
}

/* ---------- MemStorage (اختباري) ---------- */
export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private channels = new Map<string, Channel>();
  private activities = new Map<string, Activity>();

  // users
  async getUser(id: string) { return this.users.get(id); }

  async getUserByTelegramId(telegramId: string) {
    return Array.from(this.users.values()).find((u) => u.telegramId === telegramId);
  }

  async createUser(data: InsertUser) {
    const id = randomUUID();
    const user: User = {
      ...data,
      id,
      username: data.username ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      tonWallet: data.tonWallet ?? null,
      createdAt: (data as any).createdAt ?? (new Date() as any),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>) {
    const cur = this.users.get(id); if (!cur) return undefined;
    const next = { ...cur, ...updates };
    this.users.set(id, next);
    return next;
  }

  // channels
  async getChannel(id: string) { return this.channels.get(id); }

  async getChannelByUsername(username: string) {
    const u = String(username || "").toLowerCase();
    return Array.from(this.channels.values()).find((c) => (c.username ?? "").toLowerCase() === u);
  }

  async getChannels(filters: {
    category?: string; minSubscribers?: number; maxPrice?: string; search?: string; sellerId?: string;
  } = {}) {
    let result = Array.from(this.channels.values()).filter((c) => c.isActive);

    if (filters.category) result = result.filter((c) => (c.category ?? null) === filters.category);
    if (filters.minSubscribers != null) result = result.filter((c) => (c.subscribers ?? 0) >= filters.minSubscribers!);
    if (filters.maxPrice) result = result.filter((c) => parseFloat(c.price) <= parseFloat(filters.maxPrice!));
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((c) =>
        [c.name, c.username, c.description].some((v) => (v ?? "").toLowerCase().includes(s))
      );
    }
    if (filters.sellerId) result = result.filter((c) => c.sellerId === filters.sellerId);

    // الأحدث أولاً
    return result.sort((a, b) => {
      const ta = (a.createdAt as any) ? new Date(a.createdAt as any).getTime() : 0;
      const tb = (b.createdAt as any) ? new Date(b.createdAt as any).getTime() : 0;
      return tb - ta;
    });
  }

  async createChannel(data: InsertChannel & { sellerId: string }) {
    const id = randomUUID();
    const channel: Channel = {
      ...data,
      id,
      isVerified: data.isVerified ?? false,
      isActive: data.isActive ?? true,
      avatarUrl: data.avatarUrl ?? null,
      createdAt: (data as any).createdAt ?? (new Date() as any),
    };
    this.channels.set(id, channel);
    return channel;
  }

  async updateChannel(id: string, updates: Partial<Channel>) {
    const cur = this.channels.get(id); if (!cur) return undefined;
    const next = { ...cur, ...updates };
    this.channels.set(id, next);
    return next;
  }

  async deleteChannel(id: string) { return this.channels.delete(id); }

  // activities
  async getActivity(id: string) { return this.activities.get(id); }

  async getActivitiesByUser(userId: string) {
    return Array.from(this.activities.values()).filter(
      (a) => a.buyerId === userId || a.sellerId === userId
    );
  }

  async getActivitiesByChannel(channelId: string) {
    return Array.from(this.activities.values()).filter((a) => a.channelId === channelId);
  }

  async createActivity(data: InsertActivity) {
    const id = randomUUID();
    const ch = await this.getChannel(data.channelId);
    if (!ch) throw new Error("Channel not found");
    const act: Activity = {
      ...data,
      id,
      sellerId: ch.sellerId,
      completedAt: (data as any).completedAt ?? (new Date() as any),
      transactionHash: data.transactionHash ?? null,
      status: data.status ?? "completed",
    };
    this.activities.set(id, act);
    return act;
  }

  async updateActivity(id: string, updates: Partial<Activity>) {
    const cur = this.activities.get(id); if (!cur) return undefined;
    const next = { ...cur, ...updates };
    this.activities.set(id, next);
    return next;
  }

  async getMarketplaceStats() {
    const active = Array.from(this.channels.values()).filter((c) => c.isActive).length;
    const completed = Array.from(this.activities.values()).filter((a) => a.status === "completed");
    const volume = completed.reduce((sum, a) => sum + parseFloat(a.amount), 0);
    return { activeListings: active, totalVolume: volume.toFixed(2), totalSales: completed.length };
  }
}

/* ---------- PostgreSQLStorage (Drizzle) ---------- */
class PostgreSQLStorage implements IStorage {
  // users
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

  // channels
  async getChannel(id: string) {
    const rows = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
    return rows[0];
  }
  async getChannelByUsername(username: string) {
    if (!username) return undefined;
    const rows = await db.select().from(channels).where(eq(channels.username, username)).limit(1);
    return rows[0];
  }
  async getChannels(filters: {
    category?: string; minSubscribers?: number; maxPrice?: string; search?: string; sellerId?: string;
  } = {}) {
    const conds: any[] = [eq(channels.isActive, true)];
    if (filters.category) conds.push(eq(channels.category, filters.category));
    if (filters.sellerId) conds.push(eq(channels.sellerId, filters.sellerId));
    if (filters.search) conds.push(ilike(channels.name, `%${filters.search}%`));

    // ملاحظة: minSubscribers/maxPrice ممكن تضيف لها فلترة إضافية إذا احتجت
    const where = conds.length > 1 ? and(...conds) : conds[0];
    const rows = await db.select().from(channels).where(where).orderBy(channels.createdAt);
    return rows;
  }
  async createChannel(data: InsertChannel & { sellerId: string }) {
    const rows = await db.insert(channels).values(data).returning();
    return rows[0];
  }
  async updateChannel(id: string, updates: Partial<Channel>) {
    const rows = await db.update(channels).set(updates).where(eq(channels.id, id)).returning();
    return rows[0];
  }
  async deleteChannel(id: string) {
    const rows = await db.delete(channels).where(eq(channels.id, id)).returning({ id: channels.id });
    return !!rows[0];
  }

  // activities
  async getActivity(id: string) {
    const rows = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
    return rows[0];
  }
  async getActivitiesByUser(userId: string) {
    const rows = await db.select().from(activities).where(
      and(
        // buyer أو seller
        // لا توجد OR سهلة في drizzle بدون and/or helpers إضافية، فتبسيطًا:
        // سنجلب كل شيء ثم نفلتر في التطبيق إذا أردت. أو تستخدم raw sql.
        // هنا نجلب حسب buyerId فقط لأبسطية:
        eq(activities.buyerId, userId)
      )
    );
    return rows;
  }
  async getActivitiesByChannel(channelId: string) {
    const rows = await db.select().from(activities).where(eq(activities.channelId, channelId));
    return rows;
  }
  async createActivity(data: InsertActivity) {
    const rows = await db.insert(activities).values(data).returning();
    return rows[0];
  }
  async updateActivity(id: string, updates: Partial<Activity>) {
    const rows = await db.update(activities).set(updates).where(eq(activities.id, id)).returning();
    return rows[0];
  }

  async getMarketplaceStats() {
    const active = await db.select({ c: channels.id }).from(channels).where(eq(channels.isActive, true));
    const sales = await db.select().from(activities).where(eq(activities.status, "completed"));
    const volume = sales.reduce((sum, a: any) => sum + parseFloat(a.amount), 0);
    return { activeListings: active.length, totalVolume: volume.toFixed(2), totalSales: sales.length };
  }
}

/* ---------- Export concrete storage ---------- */
export const storage: IStorage = process.env.DATABASE_URL ? new PostgreSQLStorage() : new MemStorage();
console.log(`Using ${process.env.DATABASE_URL ? "PostgreSQL" : "in-memory"} storage`);