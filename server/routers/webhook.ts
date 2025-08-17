// server/routers/webhook.ts
import type { Express } from "express";
import express from "express";

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup && { reply_markup: replyMarkup }),
    };

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(t);
    const result = await response.json();
    if (!result.ok) console.error("Failed to send message:", result);
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text: string) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
      }
    );
    const result = await response.json();
    if (!result.ok) console.error("Failed to answer callback query:", result);
  } catch (error) {
    console.error("Error answering callback query:", error);
  }
}

export function mountWebhook(app: Express, WEBAPP_URL: string) {
  app.get("/api/config", (_req, res) => {
    res.json({
      API_BASE_URL: process.env.API_BASE_URL || "",
      WEBAPP_URL,
    });
  });

  app.post("/webhook/telegram", express.json(), async (req, res) => {
    try {
      const update = req.body;

      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const user = update.message.from;

        if (text === "/start") {
          await sendTelegramMessage(
            chatId,
            `🎉 Welcome to Telegram Channel Marketplace!\n\n` +
              `🔥 Buy and sell Telegram channels securely with escrow protection.\n\n` +
              `📱 Start trading channels safely today!`,
            { inline_keyboard: [[{ text: "🚀 Open Marketplace", web_app: { url: WEBAPP_URL } }]] }
          );
        } else {
          await sendTelegramMessage(
            chatId,
            `👋 Hi ${user.first_name}!\n\nUse /start to access the Channel Marketplace.\n\n🌐 Direct link: ${WEBAPP_URL}`
          );
        }
      }

      if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const data = callbackQuery.data;
        console.log(`Callback: ${data}`);
        await answerCallbackQuery(callbackQuery.id, "Opening marketplace...");
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  app.all("/webhook/telegram", (req, res) => {
    if (req.method === "GET") {
      res.json({
        message: "Webhook endpoint is active - POST method required for Telegram updates",
        method: req.method,
        timestamp: new Date().toISOString(),
        server: "Express on Render",
        endpoint: "/webhook/telegram",
      });
    } else {
      res.status(405).send("Method Not Allowed - POST required");
    }
  });
}