// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});
pool.on("connect", () => console.log("Connected to PostgreSQL"));
pool.on("error", (err) => console.error("PostgreSQL connection error:", err));

export const db = drizzle(pool, { schema });
export async function closeDb() { await pool.end(); }
export function isDbUniqueError(err: any): boolean {
  return !!err && (err.code === "23505" || /unique/i.test(String(err.message)));
}