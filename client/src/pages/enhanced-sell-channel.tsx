import {
  type User,
  type InsertUser,
  type Channel,
  type InsertChannel,
  type Activity,
  type InsertActivity,
  type GiftType
} from "@shared/schema";
import { randomUUID } from "crypto";
import { PostgreSQLStorage } from "./db";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Channel operations
  getChannel(id: string): Promise<Channel | undefined>;
  getChannelByUsername(username: string): Promise<Channel | undefined>;
  getChannels(filters?: {
    category?: string;
    minSubscribers?: number;
    maxPrice?: string;
    search?: string;
    sellerId?: string;
  }): Promise<(Channel & { giftCounts: Record<GiftType, number> })[]>;
  createChannel(channel: InsertChannel & { sellerId: string }): Promise<Channel>;
  updateChannel(id: string, updates: Partial<Channel>): Promise<Channel | undefined>;
  deleteChannel(id: string): Promise<boolean>;

  // Activity operations
  getActivity(id: string): Promise<Activity | undefined>;
  getActivitiesByUser(userId: string): Promise<Activity[]>;
  getActivitiesByChannel(channelId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: string, updates: Partial<Activity>): Promise<Activity | undefined>;

  // Statistics
  getMarketplaceStats(): Promise<{
    activeListings: number;
    totalVolume: string;
    totalSales: number;
  }>;
}

export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private channels = new Map<string, Channel>();
  private activities = new Map<string, Activity>();

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
      username: data.username || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      tonWallet: data.tonWallet || null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    return this.channels.get(id);
  }

  async getChannelByUsername(username: string): Promise<Channel | undefined> {
    return Array.from(this.channels.values()).find((c) => c.username === username);
  }

  async getChannels(filters = {}): Promise<(Channel & { giftCounts: Record<GiftType, number> })[]> {
    let result = Array.from(this.channels.values()).filter((c) => c.isActive);

    if (filters.category) result = result.filter((c) => c.category === filters.category);
    if (filters.minSubscribers) result = result.filter((c) => c.subscribers >= filters.minSubscribers);
    if (filters.maxPrice) result = result.filter((c) => parseFloat(c.price) <= parseFloat(filters.maxPrice));
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.username.toLowerCase().includes(search) ||
          c.description.toLowerCase().includes(search)
      );
    }
    if (filters.sellerId) result = result.filter((c) => c.sellerId === filters.sellerId);

    const full = await Promise.all(
      result.map(async (channel) => {
        const activities = await this.getActivitiesByChannel(channel.id);
        const giftCounts: Record<GiftType, number> = {
          "statue-of-liberty": 0,
          "flame-of-liberty": 0,
        };
        for (const a of activities) {
          if (a.status === "completed" && a.giftType) {
            giftCounts[a.giftType] = (giftCounts[a.giftType] || 0) + 1;
          }
        }
        return { ...channel, giftCounts };
      })
    );

    return full.sort((a, b) => b.subscribers - a.subscribers);
  }

  async createChannel(data: InsertChannel & { sellerId: string }): Promise<Channel> {
    const id = randomUUID();
    const channel: Channel = {
      ...data,
      id,
      isVerified: false,
      isActive: true,
      avatarUrl: data.avatarUrl || null,
    };
    this.channels.set(id, channel);
    return channel;
  }

  async updateChannel(id: string, updates: Partial<Channel>): Promise<Channel | undefined> {
    const current = this.channels.get(id);
    if (!current) return undefined;
    const updated = { ...current, ...updates };
    this.channels.set(id, updated);
    return updated;
  }

  async deleteChannel(id: string): Promise<boolean> {
    return this.channels.delete(id);
  }

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
    const channel = await this.getChannel(data.channelId);
    if (!channel) throw new Error("Channel not found");

    const completedAt = new Date().toISOString();
    const activity: Activity = {
      ...data,
      id,
      sellerId: channel.sellerId,
      completedAt,
      transactionHash: data.transactionHash || null,
      status: "completed",
    };
    this.activities.set(id, activity);
    return activity;
  }

  async updateActivity(id: string, updates: Partial<Activity>): Promise<Activity | undefined> {
    const activity = this.activities.get(id);
    if (!activity) return undefined;
    const updated = { ...activity, ...updates };
    this.activities.set(id, updated);
    return updated;
  }

  async getMarketplaceStats(): Promise<{
    activeListings: number;
    totalVolume: string;
    totalSales: number;
  }> {
    const listings = Array.from(this.channels.values()).filter((c) => c.isActive).length;
    const completed = Array.from(this.activities.values()).filter((a) => a.status === "completed");
    const volume = completed.reduce((sum, a) => sum + parseFloat(a.amount), 0);
    return {
      activeListings: listings,
      totalVolume: volume.toFixed(2),
      totalSales: completed.length,
    };
  }
}

// Switch to DB if needed
const databaseUrl = process.env.DATABASE_URL;
export const storage: IStorage = databaseUrl ? new PostgreSQLStorage(databaseUrl) : new MemStorage();
console.log(`Using ${databaseUrl ? 'PostgreSQL' : 'in-memory'} storage`);