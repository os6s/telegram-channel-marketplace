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
  const initData =
    req.get("x-telegram-init-data") ||
    (typeof req.body?.initData === "string" ? req.body.initData : undefined);

  if (!token || !initData || !verifyInitData(initData, token)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");
  const user = userRaw ? JSON.parse(userRaw) : undefined;

  if (!user?.id) return res.status(401).json({ error: "unauthorized" });

  (req as any).telegramUser = user; // { id, first_name, last_name, username, ... }
  next();
}