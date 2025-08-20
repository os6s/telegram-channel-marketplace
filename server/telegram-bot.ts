// server/telegram-bot.ts
import express from "express";

/* =========================
   Types
========================= */
interface TelegramMessage {
  message_id: number;
  from: { id: number; is_bot: boolean; first_name: string; username?: string };
  chat: { id: number; type: string };
  date: number;
  text?: string;
}
interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: any;
}

/* =========================
   Bot class (no webhook mgmt in prod)
========================= */
export class TelegramBot {
  private token: string;
  private baseUrl: string;
  private activeMonitors = new Map<string, NodeJS.Timeout>();

  constructor(token: string) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(chatId: number | string, text: string, replyMarkup?: any) {
    try {
      const r = await fetch(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          reply_markup: replyMarkup,
          parse_mode: "HTML",
        }),
      });
      return await r.json();
    } catch (e) {
      console.error("Error sending message:", e);
    }
  }

  async checkChannelOwnership(channelId: string, userId: number): Promise<boolean> {
    try {
      const r = await fetch(`${this.baseUrl}/getChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: channelId, user_id: userId }),
      });
      const j = await r.json();
      return j.ok && ["creator", "administrator"].includes(j.result?.status);
    } catch (e) {
      console.error("Error checking channel ownership:", e);
      return false;
    }
  }

  async monitorChannelTransfer(channelId: string, sellerId: number, buyerId: number, escrowId: string) {
    const existing = this.activeMonitors.get(escrowId);
    if (existing) clearInterval(existing);

    let checks = 0;
    const maxChecks = 48; // 24h @ 30s
    const h = setInterval(async () => {
      checks++;
      try {
        const buyerOwns = await this.checkChannelOwnership(channelId, buyerId);
        const sellerOwns = await this.checkChannelOwnership(channelId, sellerId);

        if (buyerOwns && !sellerOwns) {
          this.cleanupMonitor(escrowId);
          await this.sendMessage(
            buyerId,
            `🎉 <b>Channel Transfer Complete!</b>\n\nYou are now the owner. Escrow will be released.\n\n<b>Channel:</b> ${channelId}\n<b>Status:</b> ✅ Ownership Verified`
          );
          await this.sendMessage(
            sellerId,
            `✅ <b>Transfer Confirmed</b>\nBuyer is now the owner.\n\n<b>Channel:</b> ${channelId}\n<b>Status:</b> ✅ Verified`
          );
        } else if (checks >= maxChecks) {
          this.cleanupMonitor(escrowId);
          await this.sendMessage(
            buyerId,
            `⚠️ <b>Transfer Timeout</b>\nNo completion within 24h. Please contact support.\n\n<b>Channel:</b> ${channelId}`
          );
        }
      } catch (e) {
        console.error("Error monitoring channel transfer:", e);
      }
    }, 30_000);

    this.activeMonitors.set(escrowId, h);
  }

  private cleanupMonitor(escrowId: string) {
    const h = this.activeMonitors.get(escrowId);
    if (h) {
      clearInterval(h);
      this.activeMonitors.delete(escrowId);
    }
  }
  cleanupAllMonitors() {
    this.activeMonitors.forEach(clearInterval);
    this.activeMonitors.clear();
  }

  handleUpdate(update: TelegramUpdate) {
    if (update.message) this.handleMessage(update.message);
    if (update.callback_query) this.handleCallbackQuery(update.callback_query);
  }

  private async handleCallbackQuery(cq: any) {
    const chatId = cq.message?.chat?.id;
    const data = cq.data;

    if (chatId && data) {
      if (data === "how_it_works") {
        await this.sendMessage(
          chatId,
          [
            "📋 <b>How Channel Marketplace Works</b>",
            "",
            "1️⃣ Browse channels",
            "2️⃣ Secure escrow payment (TON)",
            "3️⃣ Ownership verification",
            "4️⃣ Safe transfer",
            "",
            "💰 Escrow: held until transfer, refund if failed.",
            "🔒 Verification: seller proves ownership.",
          ].join("\n")
        );
      } else if (data === "support") {
        await this.sendMessage(
          chatId,
          [
            "💬 <b>Need Help?</b>",
            "",
            "• Technical issues",
            "• Transaction problems",
            "• Account questions",
            "",
            "Contact support from the app.",
          ].join("\n")
        );
      }
    }

    await fetch(`${this.baseUrl}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cq.id }),
    });
  }

  private async handleMessage(msg: TelegramMessage) {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (text === "/start") {
      const webappUrl = process.env.WEBAPP_URL;
      const welcome = `
🎉 <b>Welcome to Channel Marketplace!</b>

Buy & sell Telegram channels with secure TON escrow.

🔥 <b>Features</b>
• Verified listings
• Escrow protection
• Ownership verification

${webappUrl ? "👇 <b>Open the marketplace:</b>" : "⚠️ WEBAPP_URL is not configured."}
      `.trim();

      const keyboard = webappUrl
        ? {
            inline_keyboard: [
              [{ text: "🛒 Open Marketplace", web_app: { url: webappUrl } }],
              [
                { text: "📋 How it works", callback_data: "how_it_works" },
                { text: "💬 Support", callback_data: "support" },
              ],
            ],
          }
        : undefined;

      await this.sendMessage(chatId, welcome, keyboard);
    }
  }
}

/* =========================
   Singleton + helpers
========================= */
let botInstance: TelegramBot | null = null;

/** Send a message to any Telegram user from anywhere in the server */
export async function notifyUser(telegramId: string | number, text: string) {
  if (!botInstance) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error("TELEGRAM_BOT_TOKEN not set - cannot send Telegram notifications");
      return;
    }
    botInstance = new TelegramBot(token);
  }
  await botInstance.sendMessage(telegramId, text);
}

/* =========================
   Route registration
   - DEV: polling (webhook removed)
   - PROD: webhook handled elsewhere (routers/webhook.ts + setWebhook done outside)
========================= */
export function registerBotRoutes(app: express.Express) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN not set - bot disabled");
    return;
  }
  botInstance = new TelegramBot(token);

  if (process.env.NODE_ENV === "development") {
    // Use long polling locally for convenience
    removeWebhookSafe(token).then(() => {
      console.log("Webhook removed for development mode (polling on).");
      startPolling(botInstance!);
    });
  } else {
    console.log("Production mode: webhook managed via routers/webhook.ts and external setWebhook.");
  }

  console.log("Telegram bot routes registered");
}

/* =========================
   Internals
========================= */
async function removeWebhookSafe(token: string) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drop_pending_updates: true }),
    });
    await r.json().catch(() => ({}));
  } catch (e) {
    console.warn("deleteWebhook failed (dev):", e);
  }
}

async function startPolling(bot: TelegramBot) {
  let offset = 0;
  const poll = async () => {
    try {
      const r = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`
      );
      const data = await r.json();
      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        for (const update of data.result) {
          bot.handleUpdate(update);
          offset = update.update_id + 1;
        }
      }
    } catch (e) {
      console.error("Polling error:", e);
    }
    setTimeout(poll, 1000);
  };
  console.log("Starting Telegram bot polling (development)...");
  poll();
}