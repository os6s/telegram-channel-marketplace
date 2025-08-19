// server/routers/webhook.ts
import type { Express } from "express";
import express from "express";

function mustToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN not set");
  return t;
}

async function tgFetch(path: string, body: any) {
  const token = mustToken();
  const r = await fetch(`https://api.telegram.org/bot${token}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  return r.json();
}

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  const res = await tgFetch("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(replyMarkup && { reply_markup: replyMarkup }),
    disable_web_page_preview: true,
  });
  if (!res?.ok) console.error("sendMessage failed:", res);
}

async function answerCallbackQuery(id: string, text?: string) {
  const res = await tgFetch("answerCallbackQuery", { callback_query_id: id, text });
  if (!res?.ok) console.error("answerCallbackQuery failed:", res);
}

export function mountWebhook(app: Express, WEBAPP_URL: string) {
  app.post("/webhook/telegram", express.json({ limit: "1mb" }), async (req, res) => {
    // أعد 200 فورًا لتجنّب مهلة تيليجرام
    res.status(200).send("OK");

    try {
      mustToken();
      const update = req.body;

      // رسائل نصية
      if (update.message) {
        const msg = update.message;
        const chatId = msg.chat.id as number;
        const txt: string = msg.text ?? "";
        const first = msg.from?.first_name || "there";

        // بيانات قادمة من WebApp (لو استعملت WebApp.sendData)
        const webapp = msg.web_app_data?.data;
        if (webapp) {
          console.log("web_app_data:", webapp);
          await sendMessage(chatId, "✅ Received. Opening marketplace…", {
            inline_keyboard: [[{ text: "🚀 Open Marketplace", web_app: { url: WEBAPP_URL } }]],
          });
          return;
        }

        // /start مع startparam اختياري (إحالة/تحميل مُسبق)
        // مثال: /start ref_123
        if (txt?.startsWith("/start")) {
          const payload = txt.split(" ").slice(1).join(" ").trim(); // startparam
          if (payload) console.log("Deep-link payload:", payload);

          await sendMessage(
            chatId,
            `🎉 Welcome, ${first}!\n\n` +
              `🔥 Buy & sell Telegram assets with escrow.\n` +
              `🛡️ Funds held until buyer confirms.\n\n` +
              `Tap the button to open the marketplace.`,
            { inline_keyboard: [[{ text: "🚀 Open Marketplace", web_app: { url: WEBAPP_URL } }]] }
          );
          return;
        }

        // أوامر بسيطة
        if (txt === "/help") {
          await sendMessage(
            chatId,
            `Commands:\n/start – Open marketplace\n/help – This help\n`,
          );
          return;
        }

        // رد افتراضي
        await sendMessage(
          chatId,
          `👋 Hi ${first}.\nUse /start to open the marketplace.\n\n🌐 ${WEBAPP_URL}`,
          { inline_keyboard: [[{ text: "🚀 Open", web_app: { url: WEBAPP_URL } }]] }
        );
        return;
      }

      // أزرار callback العادية
      if (update.callback_query) {
        const cq = update.callback_query;
        console.log("Callback data:", cq.data);
        await answerCallbackQuery(cq.id, "Opening marketplace…");
        const chatId = cq.message?.chat?.id;
        if (chatId) {
          await sendMessage(chatId, "🚀 Opening…", {
            inline_keyboard: [[{ text: "Open Marketplace", web_app: { url: WEBAPP_URL } }]],
          });
        }
        return;
      }
    } catch (err: any) {
      console.error("Webhook error:", err?.message || err);
    }
  });

  // فحص سريع لنفس المسار
  app.all("/webhook/telegram", (req, res) => {
    if (req.method === "GET") {
      res.json({
        message: "Webhook endpoint is active. POST updates here.",
        ts: new Date().toISOString(),
        endpoint: "/webhook/telegram",
      });
    } else if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
    } else {
      res.sendStatus(200);
    }
  });

  // مشاركة إعدادات للفرونت
  app.get("/api/config", (_req, res) => {
    res.json({
      API_BASE_URL: process.env.API_BASE_URL || "",
      WEBAPP_URL,
    });
  });
}