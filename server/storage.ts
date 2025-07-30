import { type User, type InsertUser, type Channel, type InsertChannel, type Activity, type InsertActivity } from "@shared/schema";
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
  }): Promise<Channel[]>;
  createChannel(channel: InsertChannel): Promise<Channel>;
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
  private users: Map<string, User>;
  private channels: Map<string, Channel>;
  private activities: Map<string, Activity>;

  constructor() {
    this.users = new Map();
    this.channels = new Map();
    this.activities = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.telegramId === telegramId,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      username: insertUser.username || null,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      tonWallet: insertUser.tonWallet || null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    return this.channels.get(id);
  }

  async getChannelByUsername(username: string): Promise<Channel | undefined> {
    return Array.from(this.channels.values()).find(
      (channel) => channel.username === username,
    );
  }

  async getChannels(filters?: {
    category?: string;
    minSubscribers?: number;
    maxPrice?: string;
    search?: string;
    sellerId?: string;
  }): Promise<Channel[]> {
    let channels = Array.from(this.channels.values()).filter(c => c.isActive);

    if (filters) {
      if (filters.category) {
        channels = channels.filter(c => c.category === filters.category);
      }
      if (filters.minSubscribers) {
        channels = channels.filter(c => c.subscribers >= filters.minSubscribers!);
      }
      if (filters.maxPrice) {
        channels = channels.filter(c => parseFloat(c.price) <= parseFloat(filters.maxPrice!));
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        channels = channels.filter(c => 
          c.name.toLowerCase().includes(search) ||
          c.username.toLowerCase().includes(search) ||
          c.description.toLowerCase().includes(search)
        );
      }
      if (filters.sellerId) {
        channels = channels.filter(c => c.sellerId === filters.sellerId);
      }
    }

    return channels.sort((a, b) => b.subscribers - a.subscribers);
  }

  async createChannel(insertChannel: InsertChannel & { sellerId: string }): Promise<Channel> {
    const id = randomUUID();
    const channel: Channel = { 
      ...insertChannel, 
      id,
      isVerified: false,
      isActive: true,
      avatarUrl: insertChannel.avatarUrl || null
    };
    this.channels.set(id, channel);
    return channel;
  }

  async updateChannel(id: string, updates: Partial<Channel>): Promise<Channel | undefined> {
    const channel = this.channels.get(id);
    if (!channel) return undefined;
    
    const updatedChannel = { ...channel, ...updates };
    this.channels.set(id, updatedChannel);
    return updatedChannel;
  }

  async deleteChannel(id: string): Promise<boolean> {
    return this.channels.delete(id);
  }

  async getActivity(id: string): Promise<Activity | undefined> {
    return this.activities.get(id);
  }

  async getActivitiesByUser(userId: string): Promise<Activity[]> {
    return Array.from(this.activities.values()).filter(
      (activity) => activity.buyerId === userId || activity.sellerId === userId,
    );
  }

  async getActivitiesByChannel(channelId: string): Promise<Activity[]> {
    return Array.from(this.activities.values()).filter(
      (activity) => activity.channelId === channelId,
    );
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const id = randomUUID();
    const channel = await this.getChannel(insertActivity.channelId);
    if (!channel) throw new Error("Channel not found");
    
    const completedAt = new Date().toISOString();
    
    const activity: Activity = { 
      ...insertActivity, 
      id,
      sellerId: channel.sellerId,
      status: "completed",
      completedAt,
      transactionHash: insertActivity.transactionHash || null
    };
    this.activities.set(id, activity);
    return activity;
  }

  async updateActivity(id: string, updates: Partial<Activity>): Promise<Activity | undefined> {
    const activity = this.activities.get(id);
    if (!activity) return undefined;
    
    const updatedActivity = { ...activity, ...updates };
    this.activities.set(id, updatedActivity);
    return updatedActivity;
  }

  async getMarketplaceStats(): Promise<{
    activeListings: number;
    totalVolume: string;
    totalSales: number;
  }> {
    const activeChannels = Array.from(this.channels.values()).filter(c => c.isActive);
    const completedActivities = Array.from(this.activities.values()).filter(a => a.status === "completed");
    
    const totalVolume = completedActivities
      .reduce((sum, activity) => sum + parseFloat(activity.amount), 0);

    return {
      activeListings: activeChannels.length,
      totalVolume: totalVolume.toFixed(2),
      totalSales: completedActivities.length
    };
  }
}

// Initialize storage based on environment
const databaseUrl = process.env.DATABASE_URL;

export const storage: IStorage = databaseUrl 
  ? new PostgreSQLStorage(databaseUrl)
  : new MemStorage();

console.log(`Using ${databaseUrl ? 'PostgreSQL' : 'in-memory'} storage`);
