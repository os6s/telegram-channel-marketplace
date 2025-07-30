import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertChannelSchema, insertEscrowSchema } from "@shared/schema";
import { z } from "zod";
import { registerBotRoutes } from "./telegram-bot";

export async function registerRoutes(app: Express): Promise<Server> {
  // Redirect external visitors to Telegram bot
  app.get("/redirect-to-bot", (req, res) => {
    res.redirect(301, 'https://t.me/giftspremarketbot');
  });

  // Middleware to detect external visitors and redirect them
  app.use((req, res, next) => {
    // Only check root path requests
    if (req.path === "/" || req.path === "/index.html") {
      const userAgent = req.get('User-Agent') || '';
      const referer = req.get('Referer') || '';
      
      // Check if request is from Telegram WebApp
      const isTelegramWebApp = userAgent.includes('TelegramBot') || 
                              userAgent.includes('Telegram') ||
                              referer.includes('telegram') ||
                              req.query.tgWebAppPlatform ||
                              req.headers['x-telegram-bot-api-secret-token'];
      
      // If not from Telegram, redirect to bot
      if (!isTelegramWebApp) {
        return res.redirect(301, 'https://t.me/giftspremarketbot');
      }
    }
    
    next();
  });

  // Health check endpoint for Render
  app.get("/api/health", (req, res) => {
    res.status(200).json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Register Telegram bot routes
  registerBotRoutes(app);
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
      
      // Check if there are active escrows for this channel
      const escrows = await storage.getEscrowsByChannel(req.params.id);
      const activeEscrows = escrows.filter(e => e.status === "pending" || e.status === "paid");
      
      if (activeEscrows.length > 0) {
        return res.status(400).json({ error: "Cannot delete channel with active escrows" });
      }
      
      const success = await storage.deleteChannel(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Escrow routes
  app.get("/api/escrows", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const channelId = req.query.channelId as string;

      let escrows;
      if (userId) {
        escrows = await storage.getEscrowsByUser(userId);
      } else if (channelId) {
        escrows = await storage.getEscrowsByChannel(channelId);
      } else {
        return res.status(400).json({ error: "userId or channelId required" });
      }

      res.json(escrows);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/escrows/:id", async (req, res) => {
    try {
      const escrow = await storage.getEscrow(req.params.id);
      if (!escrow) {
        return res.status(404).json({ error: "Escrow not found" });
      }
      res.json(escrow);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/escrows", async (req, res) => {
    try {
      const escrowData = insertEscrowSchema.parse(req.body);

      // Verify channel exists and is active
      const channel = await storage.getChannel(escrowData.channelId);
      if (!channel || !channel.isActive) {
        return res.status(400).json({ error: "Channel not found or inactive" });
      }

      // Verify amount matches channel price
      if (parseFloat(escrowData.amount) !== parseFloat(channel.price)) {
        return res.status(400).json({ error: "Amount does not match channel price" });
      }

      const escrow = await storage.createEscrow(escrowData);
      res.json(escrow);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.patch("/api/escrows/:id", async (req, res) => {
    try {
      const updates = req.body;
      const escrow = await storage.updateEscrow(req.params.id, updates);
      if (!escrow) {
        return res.status(404).json({ error: "Escrow not found" });
      }
      res.json(escrow);
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