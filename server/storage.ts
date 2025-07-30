import { type User, type InsertUser, type Channel, type InsertChannel, type Escrow, type InsertEscrow } from "@shared/schema";
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

  // Escrow operations
  getEscrow(id: string): Promise<Escrow | undefined>;
  getEscrowsByUser(userId: string): Promise<Escrow[]>;
  getEscrowsByChannel(channelId: string): Promise<Escrow[]>;
  createEscrow(escrow: InsertEscrow): Promise<Escrow>;
  updateEscrow(id: string, updates: Partial<Escrow>): Promise<Escrow | undefined>;

  // Statistics
  getMarketplaceStats(): Promise<{
    activeListings: number;
    totalVolume: string;
    activeEscrows: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private channels: Map<string, Channel>;
  private escrows: Map<string, Escrow>;

  constructor() {
    this.users = new Map();
    this.channels = new Map();
    this.escrows = new Map();
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

  async getEscrow(id: string): Promise<Escrow | undefined> {
    return this.escrows.get(id);
  }

  async getEscrowsByUser(userId: string): Promise<Escrow[]> {
    return Array.from(this.escrows.values()).filter(
      (escrow) => escrow.buyerId === userId || escrow.sellerId === userId,
    );
  }

  async getEscrowsByChannel(channelId: string): Promise<Escrow[]> {
    return Array.from(this.escrows.values()).filter(
      (escrow) => escrow.channelId === channelId,
    );
  }

  async createEscrow(insertEscrow: InsertEscrow): Promise<Escrow> {
    const id = randomUUID();
    const channel = await this.getChannel(insertEscrow.channelId);
    if (!channel) throw new Error("Channel not found");
    
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    
    const escrow: Escrow = { 
      ...insertEscrow, 
      id,
      sellerId: channel.sellerId,
      status: "pending",
      expiresAt,
      botToken: insertEscrow.botToken || null
    };
    this.escrows.set(id, escrow);
    return escrow;
  }

  async updateEscrow(id: string, updates: Partial<Escrow>): Promise<Escrow | undefined> {
    const escrow = this.escrows.get(id);
    if (!escrow) return undefined;
    
    const updatedEscrow = { ...escrow, ...updates };
    this.escrows.set(id, updatedEscrow);
    return updatedEscrow;
  }

  async getMarketplaceStats(): Promise<{
    activeListings: number;
    totalVolume: string;
    activeEscrows: number;
  }> {
    const activeChannels = Array.from(this.channels.values()).filter(c => c.isActive);
    const activeEscrowsList = Array.from(this.escrows.values()).filter(e => e.status !== "completed" && e.status !== "cancelled");
    
    const totalVolume = Array.from(this.escrows.values())
      .filter(e => e.status === "completed")
      .reduce((sum, escrow) => sum + parseFloat(escrow.amount), 0);

    return {
      activeListings: activeChannels.length,
      totalVolume: totalVolume.toFixed(2),
      activeEscrows: activeEscrowsList.length
    };
  }
}

// Initialize storage based on environment
const databaseUrl = process.env.DATABASE_URL;

export const storage: IStorage = databaseUrl 
  ? new PostgreSQLStorage(databaseUrl)
  : new MemStorage();

console.log(`Using ${databaseUrl ? 'PostgreSQL' : 'in-memory'} storage`);
