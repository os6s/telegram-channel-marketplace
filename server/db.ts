// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const CONN_STR = process.env.DATABASE_URL!;
const IS_PROD = process.env.NODE_ENV === "production";

function makePool() {
  return new Pool({
    connectionString: CONN_STR,
    ssl: IS_PROD ? { rejectUnauthorized: false } : undefined,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
  });
}

let pool = makePool();

// إعادة محاولة الاتصال الأوّل مع backoff
async function ensureInitialConnect(retries = 6) {
  let delay = 500;
  for (let i = 0; i < retries; i++) {
    try {
      const c = await pool.connect();
      c.release();
      console.log("✅ Connected to PostgreSQL");
      return;
    } catch (e) {
      console.error(`⏳ DB connect failed (${i + 1}/${retries}):`, (e as Error).message);
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 2, 8000);
    }
  }
  // آخر محاولة: ارمي الخطأ ليفشل الإقلاع بوضوح
  const c = await pool.connect(); c.release();
}

pool.on("error", (err) => {
  // أخطاء قاتلة مثل: '57P01' terminated, 'ECONNRESET'
  console.error("❌ PostgreSQL pool error:", err?.code || "", err?.message || err);
});

await ensureInitialConnect();

export const db = drizzle(pool, { schema });

// heartbeat كل 30ث لضمان إبقاء الاتصالات حيّة ورصد المشاكل مبكراً
const HEARTBEAT_MS = 30_000;
const heartbeat = setInterval(async () => {
  try {
    await pool.query("select 1");
  } catch (e) {
    console.error("⚠️ DB heartbeat failed:", (e as Error).message);
  }
}, HEARTBEAT_MS);

// غلاف لتنفيذ query مع إعادة محاولة خفيفة عند أخطاء اتصال عابرة
const TRANSIENT_CODES = new Set(["57P01", "57P02", "57P03", "53300", "53400"]);
export async function safeQuery<T = unknown>(sql: string, params?: unknown[], retry = true): Promise<pg.QueryResult<T>> {
  try {
    return await pool.query<T>(sql, params as any);
  } catch (e: any) {
    const code = e?.code;
    if (retry && (code === "ECONNRESET" || TRANSIENT_CODES.has(code))) {
      // محاولة واحدة إضافية بعد انتظار قصير
      await new Promise(r => setTimeout(r, 300));
      return await pool.query<T>(sql, params as any);
    }
    throw e;
  }
}

// إغلاق سلس
export async function closeDb() {
  clearInterval(heartbeat);
  try {
    await pool.end();
    console.log("🛑 PostgreSQL pool closed.");
  } catch (err) {
    console.error("Failed to close PostgreSQL pool:", (err as Error).message);
  }
}

// فحص خطأ unique
export function isDbUniqueError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | undefined;
  return !!e && (e.code === "23505" || /unique/i.test(e.message || ""));
}