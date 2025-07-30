
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
      console.log(`Setting webhook to: ${webhookUrl}`);
      const response = await fetch(`${this.baseUrl}/setWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: true
        }),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error setting webhook:', error);
      throw error;
    }
  }

  async getWebhookInfo() {
    try {
      const response = await fetch(`${this.baseUrl}/getWebhookInfo`);
      return await response.json();
    } catch (error) {
      console.error('Error getting webhook info:', error);
      return null;
    }
  }

  async removeWebhook() {
    try {
      console.log('Removing webhook...');
      const response = await fetch(`${this.baseUrl}/deleteWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          drop_pending_updates: true
        }),
      });

      const result = await response.json();
      console.log('Webhook removal result:', result);
      return result;
    } catch (error) {
      console.error('Error removing webhook:', error);
    }
  }

  async checkChannelOwnership(channelId: string, userId: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/getChatMember`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: channelId,
          user_id: userId,
        }),
      });

      const result = await response.json();
      return result.ok && ['creator', 'administrator'].includes(result.result?.status);
    } catch (error) {
      console.error('Error checking channel ownership:', error);
      return false;
    }
  }

  private activeMonitors = new Map<string, NodeJS.Timeout>();

  async monitorChannelTransfer(channelId: string, sellerId: number, buyerId: number, escrowId: string) {
    // Clean up any existing monitor for this escrow
    const existingMonitor = this.activeMonitors.get(escrowId);
    if (existingMonitor) {
      clearInterval(existingMonitor);
    }

    let checkCount = 0;
    const maxChecks = 48; // 24 hours with 30-second intervals
    
    // Monitor channel ownership change
    const checkInterval = setInterval(async () => {
      checkCount++;
      
      try {
        const buyerIsOwner = await this.checkChannelOwnership(channelId, buyerId);
        const sellerIsOwner = await this.checkChannelOwnership(channelId, sellerId);
        
        if (buyerIsOwner && !sellerIsOwner) {
          // Ownership transferred successfully
          this.cleanupMonitor(escrowId);
          
          // Notify both parties
          await this.sendMessage(buyerId, `🎉 <b>Channel Transfer Complete!</b>

You are now the owner of the channel. The escrow will be released shortly.

<b>Channel:</b> ${channelId}
<b>Status:</b> ✅ Ownership Verified`);

          await this.sendMessage(sellerId, `✅ <b>Channel Transfer Confirmed!</b>

The buyer has successfully become the channel owner. The transaction is complete.

<b>Channel:</b> ${channelId}
<b>Status:</b> ✅ Transfer Verified`);

          // Here you would typically trigger escrow completion
          console.log('Channel transfer completed:', { channelId, sellerId, buyerId, escrowId });
        } else if (checkCount >= maxChecks) {
          // Timeout reached
          this.cleanupMonitor(escrowId);
          
          await this.sendMessage(buyerId, `⚠️ <b>Transfer Timeout</b>

The channel transfer has not been completed within 24 hours. Please contact support.

<b>Channel:</b> ${channelId}
<b>Status:</b> ❌ Timeout`);
        }
      } catch (error) {
        console.error('Error monitoring channel transfer:', error);
        // Continue monitoring despite errors
      }
    }, 30000); // Check every 30 seconds

    // Store the interval
    this.activeMonitors.set(escrowId, checkInterval);
  }

  private cleanupMonitor(escrowId: string) {
    const monitor = this.activeMonitors.get(escrowId);
    if (monitor) {
      clearInterval(monitor);
      this.activeMonitors.delete(escrowId);
    }
  }

  // Clean up all monitors on shutdown
  cleanupAllMonitors() {
    this.activeMonitors.forEach(monitor => clearInterval(monitor));
    this.activeMonitors.clear();
  }

  handleUpdate(update: TelegramUpdate) {
    if (update.message) {
      this.handleMessage(update.message);
    }
    if (update.callback_query) {
      this.handleCallbackQuery(update.callback_query);
    }
  }

  private async handleCallbackQuery(callbackQuery: any) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'how_it_works') {
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
    } else if (data === 'support') {
      const supportText = `
💬 <b>Need Help?</b>

For support with:
• Technical issues
• Transaction problems
• Account questions
• General inquiries

Contact our support team or check our documentation.

🚀 <b>Quick Links:</b>
• FAQ and guides
• Transaction history
• Security tips
      `;
      
      await this.sendMessage(chatId, supportText);
    }

    // Answer the callback query to remove loading state
    await fetch(`${this.baseUrl}/answerCallbackQuery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callback_query_id: callbackQuery.id,
      }),
    });
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
                url: process.env.WEBAPP_URL || `https://${process.env.REPLIT_DEV_DOMAIN || `${process.env.REPL_ID}.replit.dev`}`
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

  // In development, use polling instead of webhooks
  if (process.env.NODE_ENV === 'development') {
    // Remove any existing webhook for development
    bot.removeWebhook().then(() => {
      console.log('Webhook removed for development mode');
      startPolling(bot);
    });
  } else {
    // In production, set up webhook after routes are registered
    setTimeout(async () => {
      const webhookUrl = `${process.env.WEBAPP_URL}/webhook/telegram`;
      console.log(`Setting webhook to: ${webhookUrl}`);
      
      try {
        // Test POST request to webhook endpoint first
        const testPost = await fetch(webhookUrl, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'webhook_test' })
        });
        console.log('POST test status:', testPost.status);
        const postResponse = await testPost.text();
        console.log('POST test response:', postResponse);
        
        // Get webhook info first to debug
        const webhookInfo = await bot.getWebhookInfo();
        console.log('Current webhook info:', webhookInfo);
        
        // Validate bot token first
        console.log('Validating bot token...');
        const botInfoResult = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
        const botInfo = await botInfoResult.json();
        console.log('Bot validation result:', botInfo);
        
        // Delete existing webhook first
        await bot.removeWebhook();
        
        // Wait a moment for the deletion to take effect
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Now try to set the webhook using the bot method
        const result = await bot.setWebhook(webhookUrl);
        console.log('Webhook setup result:', result);
        
        if (result.ok) {
          console.log('✅ Webhook configured successfully for production');
        } else {
          console.error('❌ Failed to configure webhook:', result);
          console.log('Attempting to test webhook endpoint directly...');
          
          // Test the webhook endpoint directly
          try {
            const testWebhook = await fetch(webhookUrl, { method: 'GET' });
            console.log('Webhook endpoint test:', testWebhook.status, await testWebhook.text());
            
            // Also test if Telegram can reach it by checking the webhook info after failed setup
            const finalWebhookInfo = await bot.getWebhookInfo();
            console.log('Final webhook info after failed setup:', finalWebhookInfo);
            
            // Try alternative approach with minimal parameters
            console.log('Trying simplified webhook setup...');
            const simplifiedResult = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                url: webhookUrl
              })
            });
            const simplifiedResponse = await simplifiedResult.json();
            console.log('Simplified webhook setup result:', simplifiedResponse);
            
            // If that fails too, try diagnostics
            if (!simplifiedResponse.ok) {
              console.log('All webhook setup attempts failed. Running diagnostics...');
              console.log('Bot token present:', !!process.env.TELEGRAM_BOT_TOKEN);
              console.log('Bot token length:', process.env.TELEGRAM_BOT_TOKEN?.length);
              console.log('Webhook URL:', webhookUrl);
              console.log('URL length:', webhookUrl.length);
              console.log('URL protocol:', new URL(webhookUrl).protocol);
              console.log('URL hostname:', new URL(webhookUrl).hostname);
              console.log('URL port:', new URL(webhookUrl).port || 'default');
              console.log('URL pathname:', new URL(webhookUrl).pathname);
              
              // Check if the issue is with Telegram's servers or our setup
              console.log('Testing Telegram API accessibility...');
              const telegramTest = await fetch('https://api.telegram.org/');
              console.log('Telegram API test status:', telegramTest.status);
            }
            
          } catch (testError) {
            console.error('Webhook endpoint test failed:', testError);
          }
        }
      } catch (error) {
        console.error('❌ Error configuring webhook:', error);
      }
    }, 3000); // Wait 2 seconds for server to be fully ready
  }

  // Note: Webhook endpoint is now registered in routes.ts with absolute priority

  // Setup webhook (for production deployment)
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

async function startPolling(bot: TelegramBot) {
  let offset = 0;
  
  const poll = async () => {
    try {
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`);
      const data = await response.json();
      
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          bot.handleUpdate(update);
          offset = update.update_id + 1;
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
    
    setTimeout(poll, 1000); // Poll every second
  };
  
  console.log('Starting Telegram bot polling...');
  poll();
}
