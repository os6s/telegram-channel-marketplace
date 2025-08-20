// server/routers/webhook.ts
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";

function botToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN || undefined;
}
function expectedWebhookSecret(): string | undefined {
  return process.env.WEBHOOK_SECRET || process.env.SESSION_SECRET || undefined;
}

/* limiter بسيط بالذاكرة لكل IP */
function makeIpLimiter(limit = 120, windowMs = 60_000) {
  const hits = new Map<string, { c: number; t: number }>();
  return function ipLimiter(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const key = (req.ip || req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "na").toString();
    const rec = hits.get(key);
    if (!rec || now - rec.t > windowMs) {
      hits.set(key, { c: 1, t: now });
      return next();
    }
    if (rec.c >= limit) return res.status(429).send("Too Many Requests");
    rec.c += 1;
    next();
  };
}

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: unknown) {
  const token = botToken();
  if (!token) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = { chat_id: chatId, text, parse_mode: "HTML", ...(replyMarkup ? { reply_markup: replyMarkup } : {}) };
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 8000);
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
  clearTimeout(to);
  const j = await r.json().catch(() => ({}));
  if (!j?.ok) console.error("sendMessage failed:", j);
}

async function answerCallbackQuery(callbackQueryId: string, text: string) {
  const token = botToken();
  if (!token) return;
  const r = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j?.ok) console.error("answerCallbackQuery failed:", j);
}

export function mountWebhook(app: Express, WEBAPP_URL: string) {
  // كشف الإعدادات للعميل
  app.get("/api/config", (_req, res) => {
    res.json({
      API_BASE_URL: process.env.API_BASE_URL || "",
      WEBAPP_URL,
      BOT_ENABLED: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    });
  });

  // إن لم يوجد توكن البوت نعطّل المسار
  if (!botToken()) {
    console.warn("TELEGRAM_BOT_TOKEN not set — /webhook/telegram disabled");
    app.get("/webhook/telegram", (_req, res) => res.status(503).json({ error: "Bot disabled" }));
    return;
  }

  const ipLimiter = makeIpLimiter(120, 60_000);

  app.post(
    "/webhook/telegram",
    ipLimiter,
    express.json({ limit: "200kb", type: ["application/json"] }),
    async (req, res) => {
      try {
        const expected = expectedWebhookSecret();
        const provided = req.get("x-telegram-bot-api-secret-token");
        if (!expected || provided !== expected) return res.status(403).send("Forbidden");

        const update: unknown = req.body;

        // رسائل نصية
        const msg = (update as any)?.message;
        if (msg?.text && typeof msg.text === "string" && msg.chat?.id) {
          const chatId = Number(msg.chat.id);
          const text: string = msg.text;
          const firstName: string = (msg.from?.first_name as string) || "there";

          if (text === "/start") {
            await sendTelegramMessage(
              chatId,
              "Welcome!\nOpen the marketplace:",
              { inline_keyboard: [[{ text: "🚀 Open Marketplace", web_app: { url: WEBAPP_URL } }]] }
            );
          } else {
            await sendTelegramMessage(chatId, `Hi ${firstName}\nOpen: ${WEBAPP_URL}`);
          }
        }

        // أزرار callback
        const cq = (update as any)?.callback_query;
        if (cq?.id) {
          await answerCallbackQuery(String(cq.id), "Opening...");
        }

        res.status(200).send("OK");
      } catch (err) {
        console.error("Webhook error:", err);
        res.status(500).send("Internal Server Error");
      }
    }
  );
}