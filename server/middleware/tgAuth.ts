// server/middleware/tgAuth.ts
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

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

function safeEqHex(aHex: string, bHex: string) {
  if (aHex.length !== bHex.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(aHex, "hex"), Buffer.from(bHex, "hex")); }
  catch { return false; }
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

/** Required auth: rejects if invalid/missing */
export function tgAuth(req: Request, res: Response, next: NextFunction) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const initData = req.get("x-telegram-init-data") || (req.body && (req.body as any).initData) || "";

  if (!botToken) return res.status(500).json({ error: "server_misconfig" });
  if (!initData) return res.status(401).json({ error: "unauthorized", detail: "init_data_missing" });
  if (!verifyInitData(initData, botToken)) {
    return res.status(401).json({ error: "unauthorized", detail: "bad_signature" });
  }

  try {
    const { user, authDate } = parseTelegramUser(initData);
    if (!user?.id) return res.status(401).json({ error: "unauthorized", detail: "user_missing" });

    const maxAge = Number(process.env.TELEGRAM_INITDATA_MAX_AGE_SEC || DEFAULT_MAX_AGE_SEC);
    if (authDate && Math.floor(Date.now() / 1000) - authDate > maxAge) {
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
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized", detail: "parse_error" });
  }
}

/** Optional auth: fills req.telegramUser when valid; never blocks */
export function tgOptionalAuth(req: Request, _res: Response, next: NextFunction) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const initData = req.get("x-telegram-init-data") || (req.body && (req.body as any).initData) || "";
  if (!botToken || !initData) return next();
  if (!verifyInitData(initData, botToken)) return next();

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
    }
  } catch { /* ignore */ }
  next();
}

export function requireTelegramUser(req: Request, res: Response, next: NextFunction) {
  if (!req.telegramUser?.id) return res.status(401).json({ error: "unauthorized" });
  next();
}