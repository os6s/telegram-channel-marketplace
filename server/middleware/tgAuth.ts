// server/middleware/tgAuth.ts
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/* ========= الإعدادات ========= */
const MAX_INITDATA_BYTES = 8 * 1024;            // حد أقصى لحجم initData
const DEFAULT_MAX_AGE_SEC = 24 * 60 * 60;       // 24 ساعة
const ALLOWED_REFERRERS = [/\.telegram\.org$/i, /\.t\.me$/i];

/* ========= أنواع مساعدة ========= */
declare module "express-serve-static-core" {
  interface Request {
    telegramUser?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      language_code?: string;
      is_premium?: boolean;
    };
  }
}

/* ========= دوال مساعدة ========= */
function safeTimingEqual(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(aHex, "hex"), Buffer.from(bHex, "hex"));
  } catch {
    return false;
  }
}

function verifyInitData(initData: string, botToken: string): boolean {
  if (!initData || !botToken) return false;
  if (Buffer.byteLength(initData, "utf8") > MAX_INITDATA_BYTES) return false;

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash") || "";
  if (!hash) return false;
  urlParams.delete("hash");

  const dataCheckString = [...urlParams.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const checkHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return safeTimingEqual(checkHash, hash);
}

function parseUser(initData: string) {
  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");
  const authDateStr = params.get("auth_date");
  const user = userRaw ? JSON.parse(userRaw) : undefined;
  const authDate = authDateStr ? Number(authDateStr) : undefined;
  return { user, authDate };
}

/** يسمح بالطلبات من Telegram WebView أو أصل WEBAPP_URL بالإنتاج. يتسامح مع غياب Origin داخل WebView. */
function referrerAllowed(req: Request): boolean {
  const origin = req.get("origin") || "";
  const referer = req.get("referer") || "";
  const ua = (req.get("user-agent") || "").toLowerCase();
  const webapp = process.env.WEBAPP_URL || "";

  // داخل WebView غالباً لا يرسل Origin/Referer، فرخّص إذا كان UA تيليغرام
  const isTelegramUA = ua.includes("telegram") || ua.includes("twebview");

  // أصل الويب آب
  const allowedOrigins: string[] = [];
  if (webapp) {
    try { allowedOrigins.push(new URL(webapp).origin); } catch {}
  }

  const okByWebapp =
    (!!origin && allowedOrigins.includes(origin)) ||
    (!!referer && allowedOrigins.some((o) => referer.startsWith(o)));

  const okByTelegramHost =
    (!!origin && (() => { try { return ALLOWED_REFERRERS.some((re) => re.test(new URL(origin).hostname)); } catch { return false; } })()) ||
    (!!referer && (() => { try { return ALLOWED_REFERRERS.some((re) => re.test(new URL(referer).hostname)); } catch { return false; } })());

  if (process.env.NODE_ENV === "production") {
    return isTelegramUA || okByWebapp || okByTelegramHost;
  }
  return true; // تطوير
}

/* ========= الميدلويرات ========= */

/** إلزامي: يتحقق من initData ويملأ req.telegramUser */
export function tgAuth(req: Request, res: Response, next: NextFunction) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.status(500).json({ error: "server_misconfig", detail: "TELEGRAM_BOT_TOKEN missing" });
  }

  const initData =
    req.get("x-telegram-init-data") ||
    (typeof req.body?.initData === "string" ? req.body.initData : "");

  if (!initData) {
    return res.status(401).json({ error: "unauthorized", detail: "init_data_missing" });
  }

  if (!referrerAllowed(req)) {
    return res.status(403).json({ error: "forbidden", detail: "bad_referrer" });
  }

  if (!verifyInitData(initData, botToken)) {
    return res.status(401).json({ error: "unauthorized", detail: "bad_signature" });
  }

  try {
    const { user, authDate } = parseUser(initData);
    if (!user?.id) return res.status(401).json({ error: "unauthorized", detail: "user_missing" });

    const maxAgeSec = Number(process.env.TELEGRAM_INITDATA_MAX_AGE_SEC) || DEFAULT_MAX_AGE_SEC;
    if (authDate && Number.isFinite(authDate)) {
      const ageSec = Math.floor(Date.now() / 1000) - authDate;
      if (ageSec > maxAgeSec) {
        return res.status(401).json({ error: "unauthorized", detail: "init_data_expired" });
      }
    }

    req.telegramUser = {
      id: Number(user.id),
      username: typeof user.username === "string" ? user.username : undefined,
      first_name: user.first_name,
      last_name: user.last_name,
      language_code: user.language_code,
      is_premium: !!user.is_premium,
    };
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized", detail: "parse_error" });
  }
}

/** اختياري: يملأ telegramUser إن وجد، ولا يمنع المرور */
export function tgOptionalAuth(req: Request, _res: Response, next: NextFunction) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const initData =
    req.get("x-telegram-init-data") ||
    (typeof req.body?.initData === "string" ? req.body.initData : "");

  if (!botToken || !initData) return next();
  if (!verifyInitData(initData, botToken)) return next();

  try {
    const { user } = parseUser(initData);
    if (user?.id) {
      req.telegramUser = {
        id: Number(user.id),
        username: typeof user.username === "string" ? user.username : undefined,
        first_name: user.first_name,
        last_name: user.last_name,
        language_code: user.language_code,
        is_premium: !!user.is_premium,
      };
    }
  } catch { /* ignore */ }
  next();
}

/** حارس سريع */
export function requireTelegramUser(req: Request, res: Response, next: NextFunction) {
  if (!req.telegramUser?.id) {
    return res.status(401).json({ error: "unauthorized", detail: "telegram_user_required" });
  }
  next();
}