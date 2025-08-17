// server/storage.ts
import {
  type User,
  type InsertUser,
  type Channel,
  type InsertChannel,
  type Activity,
  type InsertActivity,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { PostgreSQLStorage } from "./db";

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

/* ---------- In-memory fallback ---------- */
export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private channels = new Map<string, Channel>();
  private activities = new Map<string, Activity>();

  // users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.telegramId === telegramId);
  }

  async createUser(data: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...data,
      id,
      username: data.username ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      tonWallet: data.tonWallet ?? null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const cur = this.users.get(id);
    if (!cur) return undefined;
    const next = { ...cur, ...updates };
    this.users.set(id, next);
    return next;
  }

  // channels
  async getChannel(id: string): Promise<Channel | undefined> {
    return this.channels.get(id);
  }

  async getChannelByUsername(username: string): Promise<Channel | undefined> {
    const u = String(username).toLowerCase();
    return Array.from(this.channels.values()).find((c) => c.username.toLowerCase() === u);
  }

  async getChannels(filters: {
    category?: string;
    minSubscribers?: number;
    maxPrice?: string;
    search?: string;
    sellerId?: string;
  } = {}): Promise<Channel[]> {
    let result = Array.from(this.channels.values()).filter((c) => c.isActive);

    if (filters.category) result = result.filter((c) => c.category === filters.category);
    if (filters.minSubscribers != null) result = result.filter((c) => (c.subscribers ?? 0) >= filters.minSubscribers!);
    if (filters.maxPrice) result = result.filter((c) => parseFloat(c.price) <= parseFloat(filters.maxPrice!));
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((c) =>
        [c.name, c.username, c.description].some((v) => (v ?? "").toLowerCase().includes(s))
      );
    }
    if (filters.sellerId) result = result.filter((c) => c.sellerId === filters.sellerId);

    // ترتيب بسيط: الأحدث أولاً
    return result.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }

  async createChannel(data: InsertChannel & { sellerId: string }): Promise<Channel> {
    const id = randomUUID();
    const channel: Channel = {
      ...data,
      id,
      isVerified: data.isVerified ?? false,
      isActive: data.isActive ?? true,
      avatarUrl: data.avatarUrl ?? null,
    };
    this.channels.set(id, channel);
    return channel;
  }

  async updateChannel(id: string, updates: Partial<Channel>): Promise<Channel | undefined> {
    const cur = this.channels.get(id);
    if (!cur) return undefined;
    const next = { ...cur, ...updates };
    this.channels.set(id, next);
    return next;
  }

  async deleteChannel(id: string): Promise<boolean> {
    return this.channels.delete(id);
  }

  // activities
  async getActivity(id: string): Promise<Activity | undefined> {
    return this.activities.get(id);
  }

  async getActivitiesByUser(userId: string): Promise<Activity[]> {
    return Array.from(this.activities.values()).filter(
      (a) => a.buyerId === userId || a.sellerId === userId
    );
  }

  async getActivitiesByChannel(channelId: string): Promise<Activity[]> {
    return Array.from(this.activities.values()).filter((a) => a.channelId === channelId);
  }

  async createActivity(data: InsertActivity): Promise<Activity> {
    const id = randomUUID();
    const ch = await this.getChannel(data.channelId);
    if (!ch) throw new Error("Channel not found");
    const act: Activity = {
      ...data,
      id,
      sellerId: ch.sellerId,
      completedAt: new Date().toISOString(),
      transactionHash: data.transactionHash ?? null,
      status: data.status ?? "completed",
    };
    this.activities.set(id, act);
    return act;
  }

  async updateActivity(id: string, updates: Partial<Activity>): Promise<Activity | undefined> {
    const cur = this.activities.get(id);
    if (!cur) return undefined;
    const next = { ...cur, ...updates };
    this.activities.set(id, next);
    return next;
  }

  async getMarketplaceStats(): Promise<{
    activeListings: number;
    totalVolume: string;
    totalSales: number;
  }> {
    const active = Array.from(this.channels.values()).filter((c) => c.isActive).length;
    const completed = Array.from(this.activities.values()).filter((a) => a.status === "completed");
    const volume = completed.reduce((sum, a) => sum + parseFloat(a.amount), 0);
    return {
      activeListings: active,
      totalVolume: volume.toFixed(2),
      totalSales: completed.length,
    };
  }
}

/* ---------- Export concrete storage ---------- */
const databaseUrl = process.env.DATABASE_URL;
export const storage: IStorage = databaseUrl
  ? new PostgreSQLStorage(databaseUrl)
  : new MemStorage();

console.log(`Using ${databaseUrl ? "PostgreSQL" : "in-memory"} storage`);