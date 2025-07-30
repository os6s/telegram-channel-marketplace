import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;
import { eq, and, ilike, gte, lte, sql } from "drizzle-orm";
import type { User, Channel, Escrow, InsertUser, InsertChannel, InsertEscrow } from "@shared/schema";
import type { IStorage } from "./storage";

// PostgreSQL Database Implementation
export class PostgreSQLStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  private pool: pg.Pool;

  constructor(connectionString: string) {
    console.log('Initializing PostgreSQL connection...');
    
    this.pool = new pg.Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    this.pool.on('connect', () => {
      console.log('Connected to PostgreSQL database');
    });
    
    this.pool.on('error', (err) => {
      console.error('PostgreSQL connection error:', err);
    });
    
    this.db = drizzle(this.pool, { schema });
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
    return result[0];
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const result = await this.db.select().from(schema.users).where(eq(schema.users.telegramId, telegramId));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await this.db.insert(schema.users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await this.db.update(schema.users).set(updates).where(eq(schema.users.id, id)).returning();
    return result[0];
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    const result = await this.db.select().from(schema.channels).where(eq(schema.channels.id, id));
    return result[0];
  }

  async getChannelByUsername(username: string): Promise<Channel | undefined> {
    const result = await this.db.select().from(schema.channels).where(eq(schema.channels.username, username));
    return result[0];
  }

  async getChannels(filters?: {
    category?: string;
    minSubscribers?: number;
    maxPrice?: string;
    search?: string;
    sellerId?: string;
  }): Promise<Channel[]> {
    let query = this.db.select().from(schema.channels);
    
    const conditions = [];
    
    if (filters?.category) {
      conditions.push(eq(schema.channels.category, filters.category));
    }
    
    if (filters?.minSubscribers) {
      conditions.push(gte(schema.channels.subscribers, filters.minSubscribers));
    }
    
    if (filters?.maxPrice) {
      conditions.push(lte(schema.channels.price, filters.maxPrice));
    }
    
    if (filters?.search) {
      conditions.push(
        sql`${schema.channels.name} ILIKE ${`%${filters.search}%`} OR ${schema.channels.description} ILIKE ${`%${filters.search}%`}`
      );
    }
    
    if (filters?.sellerId) {
      conditions.push(eq(schema.channels.sellerId, filters.sellerId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query;
  }

  async createChannel(channel: any): Promise<Channel> {
    // Channel data already includes sellerId from routes
    const result = await this.db.insert(schema.channels).values([channel]).returning();
    return result[0];
  }

  async updateChannel(id: string, updates: Partial<Channel>): Promise<Channel | undefined> {
    const result = await this.db.update(schema.channels).set(updates).where(eq(schema.channels.id, id)).returning();
    return result[0];
  }

  async deleteChannel(id: string): Promise<boolean> {
    const result = await this.db.delete(schema.channels).where(eq(schema.channels.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getEscrow(id: string): Promise<Escrow | undefined> {
    const result = await this.db.select().from(schema.escrows).where(eq(schema.escrows.id, id));
    return result[0];
  }

  async getEscrowsByUser(userId: string): Promise<Escrow[]> {
    return await this.db.select().from(schema.escrows).where(eq(schema.escrows.buyerId, userId));
  }

  async getEscrowsByChannel(channelId: string): Promise<Escrow[]> {
    return await this.db.select().from(schema.escrows).where(eq(schema.escrows.channelId, channelId));
  }

  async createEscrow(escrow: InsertEscrow): Promise<Escrow> {
    // Add required fields for database insertion
    const escrowWithRequired = { 
      ...escrow, 
      sellerId: '', // This will be set in routes
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    };
    const result = await this.db.insert(schema.escrows).values([escrowWithRequired]).returning();
    return result[0];
  }

  async updateEscrow(id: string, updates: Partial<Escrow>): Promise<Escrow | undefined> {
    const result = await this.db.update(schema.escrows).set(updates).where(eq(schema.escrows.id, id)).returning();
    return result[0];
  }

  async getMarketplaceStats(): Promise<{
    activeListings: number;
    totalVolume: string;
    activeEscrows: number;
  }> {
    const [listings] = await this.db.select({ count: sql<number>`count(*)` }).from(schema.channels);
    const [escrows] = await this.db.select({ count: sql<number>`count(*)` }).from(schema.escrows).where(eq(schema.escrows.status, 'pending'));
    const [volume] = await this.db.select({ sum: sql<string>`COALESCE(sum(${schema.escrows.amount}), '0')` }).from(schema.escrows);
    
    return {
      activeListings: listings.count,
      totalVolume: volume.sum,
      activeEscrows: escrows.count
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}