import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;
import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { User, Channel, Activity, InsertUser, InsertChannel, InsertActivity } from "@shared/schema";
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
    this.pool.on('connect', () => { console.log('Connected to PostgreSQL database'); });
    this.pool.on('error', (err) => { console.error('PostgreSQL connection error:', err); });
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

    if (filters?.category) conditions.push(eq(schema.channels.category, filters.category));
    if (filters?.minSubscribers) conditions.push(gte(schema.channels.subscribers, filters.minSubscribers));
    if (filters?.maxPrice) conditions.push(lte(schema.channels.price, filters.maxPrice));
    if (filters?.search) {
      conditions.push(
        sql`${schema.channels.name} ILIKE ${`%${filters.search}%`} OR ${schema.channels.description} ILIKE ${`%${filters.search}%`}`
      );
    }
    if (filters?.sellerId) conditions.push(eq(schema.channels.sellerId, filters.sellerId));

    if (conditions.length > 0) query = (query.where(and(...conditions)) as any);
    return await query;
  }

  async createChannel(channel: InsertChannel | any): Promise<Channel> {
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

  async getActivity(id: string): Promise<Activity | undefined> {
    const result = await this.db.select().from(schema.activities).where(eq(schema.activities.id, id));
    return result[0];
  }

  async getActivitiesByUser(userId: string): Promise<Activity[]> {
    const result = await this.db
      .select()
      .from(schema.activities)
      .where(sql`${schema.activities.buyerId} = ${userId} OR ${schema.activities.sellerId} = ${userId}`);
    return result;
  }

  async getActivitiesByChannel(channelId: string): Promise<Activity[]> {
    const result = await this.db.select().from(schema.activities).where(eq(schema.activities.channelId, channelId));
    return result;
  }

  async createActivity(activityData: InsertActivity): Promise<Activity> {
    const channel = await this.getChannel(activityData.channelId);
    if (!channel) throw new Error("Channel not found");
    const activityWithSeller = {
      ...activityData,
      sellerId: channel.sellerId,
      completedAt: new Date().toISOString(),
    };
    const result = await this.db.insert(schema.activities).values(activityWithSeller).returning();
    return result[0];
  }

  async updateActivity(id: string, updates: Partial<Activity>): Promise<Activity | undefined> {
    const result = await this.db.update(schema.activities).set(updates).where(eq(schema.activities.id, id)).returning();
    return result[0];
  }

  async getMarketplaceStats(): Promise<{ activeListings: number; totalVolume: string; totalSales: number }> {
    const [listings] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.channels)
      .where(eq(schema.channels.isActive, true));
    const [sales] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.activities)
      .where(eq(schema.activities.status, 'completed'));
    const [volume] = await this.db
      .select({ sum: sql<string>`COALESCE(sum(${schema.activities.amount}), '0')` })
      .from(schema.activities)
      .where(eq(schema.activities.status, 'completed'));

    return { activeListings: listings.count, totalVolume: volume.sum, totalSales: sales.count };
  }

  async close(): Promise<void> { await this.pool.end(); }
}

// helper: فحص unique_violation
export function isDbUniqueError(err: any): boolean {
  return !!err && (err.code === "23505" || /unique/i.test(String(err.message)));
}