
import express from 'express';

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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          reply_markup: replyMarkup,
          parse_mode: 'HTML'
        }),
      });

      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  async setWebhook(webhookUrl: string) {
    try {
      const response = await fetch(`${this.baseUrl}/setWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
        }),
      });

      return await response.json();
    } catch (error) {
      console.error('Error setting webhook:', error);
    }
  }

  handleUpdate(update: TelegramUpdate) {
    if (update.message) {
      this.handleMessage(update.message);
    }
  }

  private async handleMessage(message: TelegramMessage) {
    const chatId = message.chat.id;
    const text = message.text;

    if (text === '/start') {
      const welcomeText = `
🎉 <b>Welcome to Channel Marketplace!</b>

Buy and sell Telegram channels with secure escrow using TON cryptocurrency.

🔥 <b>Features:</b>
• Browse verified channels
• Secure escrow transactions
• TON cryptocurrency payments
• Channel ownership verification

👇 <b>Get started by opening our marketplace:</b>
      `;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🛒 Open Marketplace",
              web_app: {
                url: process.env.WEBAPP_URL || "https://your-app-url.onrender.com"
              }
            }
          ],
          [
            {
              text: "📋 How it works",
              callback_data: "how_it_works"
            },
            {
              text: "💬 Support",
              callback_data: "support"
            }
          ]
        ]
      };

      await this.sendMessage(chatId, welcomeText, keyboard);
    }
  }
}

export function registerBotRoutes(app: express.Express) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.warn('TELEGRAM_BOT_TOKEN not set - bot functionality disabled');
    return;
  }

  const bot = new TelegramBot(botToken);

  // Webhook endpoint for Telegram
  app.post('/webhook/telegram', (req, res) => {
    try {
      const update: TelegramUpdate = req.body;
      bot.handleUpdate(update);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error handling Telegram update:', error);
      res.sendStatus(500);
    }
  });

  // Setup webhook (call this once)
  app.post('/setup-webhook', async (req, res) => {
    try {
      const webhookUrl = `${req.protocol}://${req.get('host')}/webhook/telegram`;
      const result = await bot.setWebhook(webhookUrl);
      res.json(result);
    } catch (error) {
      console.error('Error setting up webhook:', error);
      res.status(500).json({ error: 'Failed to setup webhook' });
    }
  });

  console.log('Telegram bot routes registered');
}
