// server/telegram-bot.ts
import express from "express";

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  date: number;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: any;
}

export class TelegramBot {
  private token: string;
  private baseUrl: string;

  constructor(token: string) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(chatId: number, text: string, replyMarkup?: any) {
    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          reply_markup: replyMarkup,
          parse_mode: "HTML",
        }),
      });
      return await response.json();
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  async setWebhook(webhookUrl: string) {
    try {
      const response = await fetch(`${this.baseUrl}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: true,
        }),
      });
      return await response.json();
    } catch (error) {
      console.error("Error setting webhook:", error);
      throw error;
    }
  }

  async getWebhookInfo() {
    try {
      const response = await fetch(`${this.baseUrl}/getWebhookInfo`);
      return await response.json();
    } catch (error) {
      console.error("Error getting webhook info:", error);
      return null;
    }
  }

  async removeWebhook() {
    try {
      const response = await fetch(`${this.baseUrl}/deleteWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drop_pending_updates: true }),
      });
      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error removing webhook:", error);
    }
  }

  async checkChannelOwnership(channelId: string, userId: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/getChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: channelId, user_id: userId }),
      });
      const result = await response.json();
      return result.ok && ["creator", "administrator"].includes(result.result?.status);
    } catch (error) {
      console.error("Error checking channel ownership:", error);
      return false;
    }
  }

  private activeMonitors = new Map<string, NodeJS.Timeout>();

  async monitorChannelTransfer(channelId: string, sellerId: number, buyerId: number, escrowId: string) {
    const existingMonitor = this.activeMonitors.get(escrowId);
    if (existingMonitor) clearInterval(existingMonitor);

    let checkCount = 0;
    const maxChecks = 48; // 24h @ 30s

    const checkInterval = setInterval(async () => {
      checkCount++;
      try {
        const buyerIsOwner = await this.checkChannelOwnership(channelId, buyerId);
        const sellerIsOwner = await this.checkChannelOwnership(channelId, sellerId);

        if (buyerIsOwner && !sellerIsOwner) {
          this.cleanupMonitor(escrowId);

          await this.sendMessage(
            buyerId,
            `🎉 <b>Channel Transfer Complete!</b>

You are now the owner of the channel. The escrow will be released shortly.

<b>Channel:</b> ${channelId}
<b>Status:</b> ✅ Ownership Verified`
          );

          await this.sendMessage(
            sellerId,
            `✅ <b>Channel Transfer Confirmed!</b>

The buyer has successfully become the channel owner. The transaction is complete.

<b>Channel:</b> ${channelId}
<b>Status:</b> ✅ Transfer Verified`
          );

          console.log("Channel transfer completed:", { channelId, sellerId, buyerId, escrowId });
        } else if (checkCount >= maxChecks) {
          this.cleanupMonitor(escrowId);
          await this.sendMessage(
            buyerId,
            `⚠️ <b>Transfer Timeout</b>

The channel transfer has not been completed within 24 hours. Please contact support.

<b>Channel:</b> ${channelId}
<b>Status:</b> ❌ Timeout`
          );
        }
      } catch (error) {
        console.error("Error monitoring channel transfer:", error);
      }
    }, 30000);

    this.activeMonitors.set(escrowId, checkInterval);
  }

  private cleanupMonitor(escrowId: string) {
    const monitor = this.activeMonitors.get(escrowId);
    if (monitor) {
      clearInterval(monitor);
      this.activeMonitors.delete(escrowId);
    }
  }

  cleanupAllMonitors() {
    this.activeMonitors.forEach((m) => clearInterval(m));
    this.activeMonitors.clear();
  }

  handleUpdate(update: TelegramUpdate) {
    if (update.message) this.handleMessage(update.message);
    if (update.callback_query) this.handleCallbackQuery(update.callback_query);
  }

  private async handleCallbackQuery(callbackQuery: any) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === "how_it_works") {
      const howItWorksText = `
📋 <b>How Channel Marketplace Works:</b>

1️⃣ <b>Browse Channels</b> - Find channels by category, price, or subscribers
2️⃣ <b>Secure Purchase</b> - Use TON cryptocurrency with escrow protection
3️⃣ <b>Verification</b> - Ownership is verified before transfer
4️⃣ <b>Transfer</b> - Admin rights transferred to you safely

💰 <b>Escrow Protection:</b>
• Your payment is held securely
• Released only after successful transfer
• Full refund if transfer fails

🔒 <b>Verification Process:</b>
• Sellers must prove channel ownership
• Bot verification ensures legitimacy
• No fake or stolen channels
      `;
      await this.sendMessage(chatId, howItWorksText);
    } else if (data === "support") {
      const supportText = `
💬 <b>Need Help?</b>

For support with:
• Technical issues
• Transaction problems
• Account questions
• General inquiries

Contact our support team or check our documentation.
      `;
      await this.sendMessage(chatId, supportText);
    }

    await fetch(`${this.baseUrl}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQuery.id }),
    });
  }

  private async handleMessage(message: TelegramMessage) {
    const chatId = message.chat.id;
    const text = message.text;

    if (text === "/start") {
      const webappUrl = process.env.WEBAPP_URL; // لا قيم مؤقتة

      const welcomeText = `
🎉 <b>Welcome to Channel Marketplace!</b>

Buy and sell Telegram channels with secure escrow using TON cryptocurrency.

🔥 <b>Features:</b>
• Browse verified channels
• Secure escrow transactions
• TON cryptocurrency payments
• Channel ownership verification

${webappUrl ? "👇 <b>Get started by opening our marketplace:</b>" : "⚠️ WEBAPP_URL is not configured by the server admin."}
      `.trim();

      const keyboard = webappUrl
        ? {
            inline_keyboard: [
              [
                {
                  text: "🛒 Open Marketplace",
                  web_app: { url: webappUrl },
                },
              ],
              [
                { text: "📋 How it works", callback_data: "how_it_works" },
                { text: "💬 Support", callback_data: "support" },
              ],
            ],
          }
        : undefined;

      await this.sendMessage(chatId, welcomeText, keyboard);
    }
  }
}

export function registerBotRoutes(app: express.Express) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webappUrl = process.env.WEBAPP_URL;

  if (!botToken) {
    console.warn("TELEGRAM_BOT_TOKEN not set - bot functionality disabled");
    return;
  }

  const bot = new TelegramBot(botToken);

  if (process.env.NODE_ENV === "development") {
    bot.removeWebhook().then(() => {
      console.log("Webhook removed for development mode");
      startPolling(bot);
    });
  } else {
    // في الإنتاج: لا نحاول تعيين الويبهوك إذا WEBAPP_URL غير مضبوط
    if (!webappUrl) {
      console.error("WEBAPP_URL is required in production to configure Telegram webhook.");
    } else {
      setTimeout(async () => {
        const webhookUrl = `${webappUrl}/webhook/telegram`;
        try {
          // إزالة أي ويبهوك سابق
          await bot.removeWebhook();
          await new Promise((r) => setTimeout(r, 800));
          const result = await bot.setWebhook(webhookUrl);
          if (result?.ok) {
            console.log("✅ Webhook configured successfully");
          } else {
            console.error("❌ Failed to configure webhook:", result);
          }
        } catch (error) {
          console.error("❌ Error configuring webhook:", error);
        }
      }, 1500);
    }
  }

  // نقطة إعداد ويبهوك يدوية (تعمل فقط لو WEBAPP_URL مضبوط)
  app.post("/setup-webhook", async (req, res) => {
    try {
      if (!webappUrl) {
        return res.status(400).json({ error: "WEBAPP_URL env var is required" });
      }
      const webhookUrl = `${webappUrl}/webhook/telegram`;
      const result = await bot.setWebhook(webhookUrl);
      res.json(result);
    } catch (error) {
      console.error("Error setting up webhook:", error);
      res.status(500).json({ error: "Failed to setup webhook" });
    }
  });

  console.log("Telegram bot routes registered");
}

async function startPolling(bot: TelegramBot) {
  let offset = 0;

  const poll = async () => {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`
      );
      const data = await response.json();

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          bot.handleUpdate(update);
          offset = update.update_id + 1;
        }
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
    setTimeout(poll, 1000);
  };

  console.log("Starting Telegram bot polling...");
  poll();
}