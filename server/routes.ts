import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertChannelSchema, insertEscrowSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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
      res.status(400).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/channels", async (req, res) => {
    try {
      const channelData = insertChannelSchema.parse(req.body);
      
      // Check if channel username already exists
      const existingChannel = await storage.getChannelByUsername(channelData.username);
      if (existingChannel) {
        return res.status(400).json({ error: "Channel username already exists" });
      }
      
      const channel = await storage.createChannel({
        ...channelData,
        sellerId: req.body.sellerId, // This should come from authenticated user
      });
      res.json(channel);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/channels/:id", async (req, res) => {
    try {
      const updates = req.body;
      const channel = await storage.updateChannel(req.params.id, updates);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json(channel);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/channels/:id", async (req, res) => {
    try {
      const success = await storage.deleteChannel(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
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
      res.status(400).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  // Marketplace stats
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getMarketplaceStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
