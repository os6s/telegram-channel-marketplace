import type { Express } from "express";
import express from "express";

function botToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN || undefined;
}

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  const token = botToken();
  if (!token) return; // bot disabled if no token set
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = { chat_id: chatId, text, parse_mode: "HTML", ...(replyMarkup && { reply_markup: replyMarkup }) };
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 8000);
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
  clearTimeout(to);
  const j = await r.json();
  if (!j.ok) console.error("sendMessage failed:", j);
}

async function answerCallbackQuery(callbackQueryId: string, text: string) {
  const token = botToken();
  if (!token) return;
  const r = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
  const j = await r.json();
  if (!j.ok) console.error("answerCallbackQuery failed:", j);
}

export function mountWebhook(app: Express, WEBAPP_URL: string) {
  // always expose config, no defaults
  app.get("/api/config", (_req, res) => {
    res.json({
      API_BASE_URL: process.env.API_BASE_URL || "",
      WEBAPP_URL,
      BOT_ENABLED: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    });
  });

  // only accept telegram webhook if token is set
  if (!botToken()) {
    console.warn("TELEGRAM_BOT_TOKEN not set — /webhook/telegram disabled");
    // optional GET to show disabled state
    app.get("/webhook/telegram", (_req, res) => res.status(503).json({ error: "Bot disabled" }));
    return;
  }

  app.post("/webhook/telegram", express.json(), async (req, res) => {
    try {
      const update = req.body;

      if (update.message?.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const user = update.message.from;

        if (text === "/start") {
          await sendTelegramMessage(
            chatId,
            `Welcome!\nOpen the marketplace:`,
            { inline_keyboard: [[{ text: "🚀 Open Marketplace", web_app: { url: WEBAPP_URL } }]] }
          );
        } else {
          await sendTelegramMessage(chatId, `Hi ${user.first_name}\nOpen: ${WEBAPP_URL}`);
        }
      }

      if (update.callback_query) {
        await answerCallbackQuery(update.callback_query.id, "Opening...");
      }

      res.status(200).send("OK");
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).send("Internal Server Error");
    }
  });
}