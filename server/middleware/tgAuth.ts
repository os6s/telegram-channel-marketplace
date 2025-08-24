// server/middleware/tgAuth.ts
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db } from "../db.js";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

declare module "express-serve-static-core" {
  interface Request {
    telegramUser?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      language_code?: string;
      is_premium?: boolean;
      auth_date?: number;
    };
  }
}

const MAX_INITDATA_BYTES = 8 * 1024;
const DEFAULT_MAX_AGE_SEC = 24 * 60 * 60;
const DEBUG = String(process.env.DEBUG_TG_AUTH || "").toLowerCase() === "true";

function dbg(...args: any[]) {
  if (!DEBUG) return;
  console.debug("[tgAuth]", ...args);
}

function safeEqHex(aHex: string, bHex: string) {
  if (aHex.length !== bHex.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(aHex, "hex"), Buffer.from(bHex, "hex"));
  } catch {
    return false;
  }
}

function verifyInitData(initData: string, botToken: string) {
  if (!initData || !botToken) return false;
  if (Buffer.byteLength(initData, "utf8") > MAX_INITDATA_BYTES) return false;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  if (!hash) return false;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const checkHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return safeEqHex(checkHash, hash);
}

function parseTelegramUser(initData: string) {
  const params = new URLSearchParams(initData);
  const userStr = params.get("user");
  const authDate = params.get("auth_date");
  const user = userStr ? JSON.parse(userStr) : undefined;
  return { user, authDate: authDate ? Number(authDate) : undefined };
}

function redactInitDataPreview(s: string) {
  if (!s) return "";
  const head = s.slice(0, 16);
  const tail = s.slice(-16);
  return `[len=${Buffer.byteLength(s, "utf8")} "${head}...${tail}"]`;
}

/** Auto-upsert user in DB (minimal: telegramId + username) */
async function upsertUser(user: { id: number; username?: string }) {
  if (!user?.id || !user.username) return;

  const existing = await db.query.users.findFirst({
    where: eq(users.telegramId, user.id),
  });

  if (existing) {
    if (existing.username !== user.username.toLowerCase()) {
      await db
        .update(users)
        .set({ username: user.username.toLowerCase() })
        .where(eq(users.id, existing.id));
      dbg("user updated", user.username);
    }
  } else {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      telegramId: user.id,
      username: user.username.toLowerCase(),
    });
    dbg("user inserted", user.username);
  }
}

/** Required auth: rejects if invalid/missing */
export function tgAuth(req: Request, res: Response, next: NextFunction) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const initData = (req.get("x-telegram-init-data") ||
    (req.body && (req.body as any).initData) ||
    "") as string;

  if (!botToken) {
    dbg("server_misconfig: TELEGRAM_BOT_TOKEN missing");
    return res.status(500).json({ error: "server_misconfig" });
  }
  if (!initData) {
    dbg("unauthorized: init_data_missing");
    return res.status(401).json({ error: "unauthorized", detail: "init_data_missing" });
  }

  const preview = redactInitDataPreview(initData);
  dbg("received initData", preview);

  if (!verifyInitData(initData, botToken)) {
    dbg("unauthorized: bad_signature", preview);
    return res.status(401).json({ error: "unauthorized", detail: "bad_signature" });
  }

  try {
    const { user, authDate } = parseTelegramUser(initData);
    if (!user?.id) {
      dbg("unauthorized: user_missing");
      return res.status(401).json({ error: "unauthorized", detail: "user_missing" });
    }

    const maxAge = Number(process.env.TELEGRAM_INITDATA_MAX_AGE_SEC || DEFAULT_MAX_AGE_SEC);
    const nowSec = Math.floor(Date.now() / 1000);
    if (authDate && nowSec - authDate > maxAge) {
      dbg("unauthorized: init_data_expired", { authDate, nowSec, maxAge });
      return res.status(401).json({ error: "unauthorized", detail: "init_data_expired" });
    }

    req.telegramUser = {
      id: Number(user.id),
      username: typeof user.username === "string" ? user.username : undefined,
      first_name: user.first_name,
      last_name: user.last_name,
      language_code: user.language_code,
      is_premium: !!user.is_premium,
      auth_date: authDate,
    };

    dbg("auth ok", { id: req.telegramUser.id, username: req.telegramUser.username });
    next();
  } catch (e: any) {
    dbg("unauthorized: parse_error", e?.message || e);
    return res.status(401).json({ error: "unauthorized", detail: "parse_error" });
  }
}

/** Optional auth: fills req.telegramUser when valid; auto-upserts if username exists */
export async function tgOptionalAuth(req: Request, _res: Response, next: NextFunction) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const initData = (req.get("x-telegram-init-data") ||
    (req.body && (req.body as any).initData) ||
    "") as string;

  if (!botToken || !initData) return next();

  const preview = DEBUG ? redactInitDataPreview(initData) : "";
  if (!verifyInitData(initData, botToken)) {
    dbg("optional: bad_signature", preview);
    return next();
  }

  try {
    const { user, authDate } = parseTelegramUser(initData);
    if (user?.id) {
      req.telegramUser = {
        id: Number(user.id),
        username: typeof user.username === "string" ? user.username : undefined,
        first_name: user.first_name,
        last_name: user.last_name,
        language_code: user.language_code,
        is_premium: !!user.is_premium,
        auth_date: authDate,
      };
      dbg("optional auth ok", { id: req.telegramUser.id, username: req.telegramUser.username });

      if (req.telegramUser.username) {
        await upsertUser(req.telegramUser);
      }
    }
  } catch (e: any) {
    dbg("optional parse_error", e?.message || e);
  }
  next();
}

/** Required Telegram user + username (with DB upsert) */
export async function requireTelegramUser(req: Request, res: Response, next: NextFunction) {
  const user = req.telegramUser;

  if (!user?.id) {
    dbg("requireTelegramUser: missing telegramUser");
    return res.status(401).json({ error: "unauthorized", detail: "user_required" });
  }

  if (!user.username || user.username.trim() === "") {
    dbg("requireTelegramUser: username required");
    return res.status(403).json({ error: "forbidden", detail: "username_required" });
  }

  try {
    await upsertUser(user);
  } catch (e: any) {
    dbg("requireTelegramUser: db error", e?.message || e);
    return res.status(500).json({ error: "server_error", detail: "user_upsert_failed" });
  }

  next();
}
