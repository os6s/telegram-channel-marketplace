// server/middleware/tgAuth.ts
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/** يتحقق من توقيع Telegram WebApp initData */
function verifyInitData(initData: string, botToken: string) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash") || "";
  urlParams.delete("hash");

  const data = [...urlParams.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const check = crypto.createHmac("sha256", secretKey).update(data).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(check), Buffer.from(hash));
  } catch {
    return false;
  }
}

/** يستخرج user من initData بعد التحقق، ويضعه في req.telegramUser */
export function tgAuth(req: Request, res: Response, next: NextFunction) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const initDataHeader =
    req.get("x-telegram-init-data") ||
    (typeof req.body?.initData === "string" ? req.body.initData : undefined);

  // طباعة تشخيص مبكر
  if (!token) {
    console.error("[tgAuth] missing TELEGRAM_BOT_TOKEN env");
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!initDataHeader) {
    console.error("[tgAuth] missing initData (header:x-telegram-init-data or body.initData). path=", req.path);
    return res.status(401).json({ error: "unauthorized" });
  }

  // تحقق التوقيع
  const ok = verifyInitData(initDataHeader, token);
  if (!ok) {
    console.error("[tgAuth] bad_signature for path=", req.path, "len(initData)=", initDataHeader.length);
    return res.status(401).json({ error: "unauthorized" });
  }

  // قراءة user + auth_date (للتشخيص فقط)
  try {
    const params = new URLSearchParams(initDataHeader);
    const userRaw = params.get("user");
    const user = userRaw ? JSON.parse(userRaw) : undefined;

    // (اختياري للتشخيص) تحقّق من auth_date لو موجود
    const authDateStr = params.get("auth_date");
    const authDate = authDateStr ? Number(authDateStr) : undefined;
    if (authDate && Number.isFinite(authDate)) {
      const ageSec = Math.floor(Date.now() / 1000) - authDate;
      if (ageSec > 3600 * 24 * 7) {
        // لا نغيّر السلوك؛ فقط نطبع تحذير
        console.warn("[tgAuth] very old auth_date (>", ageSec, "sec) user_id=", user?.id);
      }
    }

    if (!user?.id) {
      console.error("[tgAuth] parsed user missing id");
      return res.status(401).json({ error: "unauthorized" });
    }

    (req as any).telegramUser = user; // { id, first_name, last_name, username, ... }
    return next();
  } catch (e) {
    console.error("[tgAuth] parse_error:", e);
    return res.status(401).json({ error: "unauthorized" });
  }
}