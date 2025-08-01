import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertChannelSchema, insertActivitySchema } from "@shared/schema";
import { z } from "zod";
import { registerBotRoutes } from "./telegram-bot";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register webhook route with absolute priority BEFORE any other middleware
  console.log('Registering webhook route with highest priority...');
  
  // Webhook endpoint for Telegram (absolute priority) - EXPLICIT POST ROUTE
  app.post('/webhook/telegram', express.json(), async (req, res) => {
    console.log('POST /webhook/telegram - Telegram update received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    try {
      const update = req.body;
      
      // Handle text messages
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const user = update.message.from;
        
        console.log(`📨 Message from ${user.first_name} (${user.id}): ${text}`);
        console.log(`💬 Chat ID: ${chatId}, Message ID: ${update.message.message_id}`);
        
        // Handle /start command
        if (text === '/start') {
          console.log('🎯 Processing /start command');
          await sendTelegramMessage(chatId, 
            `🎉 Welcome to Telegram Channel Marketplace!\n\n` +
            `🔥 Buy and sell Telegram channels securely with escrow protection.\n\n` +
            `💎 Features:\n` +
            `• Secure escrow transactions\n` +
            `• Channel verification\n` +
            `• TON cryptocurrency payments\n` +
            `• Trusted guarantor services\n\n` +
            `📱 Start trading channels safely today!`,
            {
              inline_keyboard: [[
                {
                  text: "🚀 Open Marketplace",
                  web_app: { url: "https://telegram-channel-marketplace.onrender.com" }
                }
              ]]
            }
          );
        } else {
          console.log('💬 Processing regular message');
          // Handle other messages
          await sendTelegramMessage(chatId,
            `👋 Hi ${user.first_name}!\n\n` +
            `Use /start to access the Channel Marketplace.\n\n` +
            `🌐 Direct link: https://telegram-channel-marketplace.onrender.com`
          );
        }
      } else {
        console.log('⚠️ No text message found in update');
      }
      
      // Handle callback queries (inline keyboard buttons)
      if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        
        console.log(`🔘 Callback from ${callbackQuery.from.first_name}: ${data}`);
        
        // Answer the callback query to remove loading state
        await answerCallbackQuery(callbackQuery.id, 'Opening marketplace...');
      }
      
      // Send the exact response Telegram expects
      res.status(200).send('OK');
      console.log('✅ Webhook response sent: 200 OK');
    } catch (error) {
      console.error('❌ Error handling Telegram update:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // Helper function to send Telegram messages
  async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    console.log(`🤖 Attempting to send message to chat ${chatId}`);
    console.log(`🔑 Bot token available: ${!!botToken}, length: ${botToken?.length}`);
    
    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        ...(replyMarkup && { reply_markup: replyMarkup })
      };
      
      console.log(`📤 Sending to: ${url}`);
      console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log(`📥 Response status: ${response.status} ${response.statusText}`);
      const result = await response.json();
      console.log(`📄 Response body:`, JSON.stringify(result, null, 2));
      
      if (result.ok) {
        console.log('✅ Message sent successfully');
      } else {
        console.error('❌ Failed to send message:', result);
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
    }
  }

  // Helper function to answer callback queries
  async function answerCallbackQuery(callbackQueryId: string, text: string) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text
        })
      });
      
      const result = await response.json();
      if (!result.ok) {
        console.error('❌ Failed to answer callback query:', result);
      }
    } catch (error) {
      console.error('❌ Error answering callback query:', error);
    }
  }

  // Catch-all webhook route to log any missed requests
  app.all('/webhook/telegram', (req, res) => {
    console.log(`⚠️  Non-POST request to webhook: ${req.method} /webhook/telegram`);
    console.log('Headers:', req.headers);
    if (req.method === 'GET') {
      res.json({ 
        message: 'Webhook endpoint is active - POST method required for Telegram updates',
        method: req.method,
        timestamp: new Date().toISOString(),
        server: 'Express on Render',
        endpoint: '/webhook/telegram'
      });
    } else {
      res.status(405).send('Method Not Allowed - POST required');
    }
  });

  // Remove duplicate GET route since it's handled by app.all below

  // Register Telegram bot routes (for webhook setup and other functionality)
  registerBotRoutes(app);

  // Health check endpoint for Render
  app.get("/api/health", (req, res) => {
    res.status(200).json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Redirect external visitors to Telegram bot
  app.get("/redirect-to-bot", (req, res) => {
    res.redirect(301, 'https://t.me/giftspremarketbot');
  });

  // TEMPORARILY DISABLE REDIRECT - Testing if this is the root cause
  app.use((req, res, next) => {
    // Skip all middleware logic for debugging
    if (req.path.startsWith('/webhook/') || 
        req.path.startsWith('/api/') || 
        req.path.startsWith('/src/') ||
        req.path.includes('.')) {
      return next();
    }
    
    const userAgent = req.get('User-Agent') || '';
    const referer = req.get('Referer') || '';
    
    // Log ALL requests to root path for analysis
    if (req.path === "/" || req.path === "/index.html") {
      console.log('🔍 ALL ROOT REQUESTS - REDIRECT DISABLED:', {
        path: req.path,
        method: req.method,
        userAgent: userAgent,
        referer: referer,
        query: req.query,
        telegramHeaders: Object.keys(req.headers).filter(h => h.includes('tg') || h.includes('telegram')),
        allHeaders: req.headers
      });
      
      console.log('✅ Allowing all requests - redirect middleware disabled for testing');
    }
    
    next();
  });
  // User routes
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByTelegramId(userData.telegramId);
      if (existingUser) {
        return res.json(existingUser);
      }

      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const telegramId = req.query.telegramId as string;
      if (!telegramId) {
        return res.status(400).json({ error: "telegramId parameter required" });
      }
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updates = req.body;
      const user = await storage.updateUser(req.params.id, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Channel routes
  app.get("/api/channels", async (req, res) => {
    try {
      const filters = {
        category: req.query.category as string,
        minSubscribers: req.query.minSubscribers ? parseInt(req.query.minSubscribers as string) : undefined,
        maxPrice: req.query.maxPrice as string,
        search: req.query.search as string,
        sellerId: req.query.sellerId as string,
      };

      const channels = await storage.getChannels(filters);
      res.json(channels);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/channels/:id", async (req, res) => {
    try {
      const channel = await storage.getChannel(req.params.id);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json(channel);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/channels", async (req, res) => {
    try {
      const { sellerId, ...channelData } = req.body;
      
      // Validate sellerId is provided
      if (!sellerId) {
        return res.status(400).json({ error: "Seller ID is required. Please authenticate first." });
      }
      
      const validatedChannelData = insertChannelSchema.parse(channelData);

      // Validate positive numbers
      if (validatedChannelData.subscribers < 0) {
        return res.status(400).json({ error: "Subscriber count cannot be negative" });
      }
      
      if (parseFloat(validatedChannelData.price) < 0) {
        return res.status(400).json({ error: "Price cannot be negative" });
      }

      // Validate username format (alphanumeric and underscores, 5-32 chars)
      const usernameRegex = /^[a-zA-Z0-9_]{5,32}$/;
      if (!usernameRegex.test(validatedChannelData.username)) {
        return res.status(400).json({ error: "Username must be 5-32 characters and contain only letters, numbers, and underscores" });
      }

      // Check if channel username already exists
      const existingChannel = await storage.getChannelByUsername(validatedChannelData.username);
      if (existingChannel) {
        return res.status(400).json({ error: "Channel username already exists" });
      }

      // Create channel with sellerId for database storage
      const channelWithSeller = {
        ...validatedChannelData,
        sellerId,
      };
      const channel = await storage.createChannel(channelWithSeller as any);
      res.json(channel);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.patch("/api/channels/:id", async (req, res) => {
    try {
      const { userId, ...updates } = req.body;
      
      // Check if channel exists
      const channel = await storage.getChannel(req.params.id);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      
      // Only channel owner can update
      if (channel.sellerId !== userId) {
        return res.status(403).json({ error: "You can only update your own channels" });
      }
      
      // Validate updates if they contain price or subscribers
      if (updates.subscribers !== undefined && updates.subscribers < 0) {
        return res.status(400).json({ error: "Subscriber count cannot be negative" });
      }
      
      if (updates.price !== undefined && parseFloat(updates.price) < 0) {
        return res.status(400).json({ error: "Price cannot be negative" });
      }
      
      const updatedChannel = await storage.updateChannel(req.params.id, updates);
      res.json(updatedChannel);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.delete("/api/channels/:id", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Check if channel exists and user owns it
      const channel = await storage.getChannel(req.params.id);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      
      if (channel.sellerId !== userId) {
        return res.status(403).json({ error: "You can only delete your own channels" });
      }
      
      // Check if there are recent activities for this channel (within 24 hours)
      const activities = await storage.getActivitiesByChannel(req.params.id);
      const recentActivities = activities.filter(a => {
        const completedTime = new Date(a.completedAt);
        const now = new Date();
        const timeDiff = now.getTime() - completedTime.getTime();
        const hoursDiff = timeDiff / (1000 * 3600);
        return hoursDiff < 24;
      });
      
      if (recentActivities.length > 0) {
        return res.status(400).json({ error: "Cannot delete channel with recent sales activity" });
      }
      
      const success = await storage.deleteChannel(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Activity routes
  app.get("/api/activities", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const channelId = req.query.channelId as string;

      let activities;
      if (userId) {
        activities = await storage.getActivitiesByUser(userId);
      } else if (channelId) {
        activities = await storage.getActivitiesByChannel(channelId);
      } else {
        return res.status(400).json({ error: "userId or channelId required" });
      }

      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/activities/:id", async (req, res) => {
    try {
      const activity = await storage.getActivity(req.params.id);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json(activity);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/activities", async (req, res) => {
    try {
      const activityData = insertActivitySchema.parse(req.body);

      // Verify channel exists and is active
      const channel = await storage.getChannel(activityData.channelId);
      if (!channel || !channel.isActive) {
        return res.status(400).json({ error: "Channel not found or inactive" });
      }

      // Verify amount matches channel price
      if (parseFloat(activityData.amount) !== parseFloat(channel.price)) {
        return res.status(400).json({ error: "Amount does not match channel price" });
      }

      const activity = await storage.createActivity(activityData);
      res.json(activity);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.patch("/api/activities/:id", async (req, res) => {
    try {
      const updates = req.body;
      const activity = await storage.updateActivity(req.params.id, updates);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      res.json(activity);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Marketplace stats
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getMarketplaceStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Channel verification endpoint
  app.post("/api/channels/:id/verify", async (req, res) => {
    try {
      const { botToken } = req.body;
      const channelId = req.params.id;

      // TODO: Implement bot verification logic
      // This would involve:
      // 1. Creating a temporary bot with the provided token
      // 2. Checking if the bot is admin of the channel
      // 3. Verifying ownership

      const channel = await storage.updateChannel(channelId, { isVerified: true });
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }

      res.json({ verified: true, channel });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Setup webhook (call this once)
  app.post('/setup-webhook', async (req, res) => {
    try {
      const webhookUrl = `${req.protocol}://${req.get('host')}/webhook/telegram`;
      // Note: Bot webhook setup is handled in telegram-bot.ts
      res.json({ 
        success: true, 
        webhook_url: webhookUrl,
        message: 'Webhook URL configured' 
      });
    } catch (error) {
      console.error('Error setting up webhook:', error);
      res.status(500).json({ error: 'Failed to setup webhook' });
    }
  });

  // GET endpoint for easy webhook setup
  app.get('/setup-webhook', async (req, res) => {
    try {
      const webhookUrl = `${req.protocol}://${req.get('host')}/webhook/telegram`;
      // Note: Bot webhook setup is handled in telegram-bot.ts
      res.json({ 
        success: true, 
        webhook_url: webhookUrl,
        message: 'Webhook URL configured' 
      });
    } catch (error) {
      console.error('Error setting up webhook:', error);
      res.status(500).json({ error: 'Failed to setup webhook' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}