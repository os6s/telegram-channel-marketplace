// server/routers/channels.ts
import type { Express } from "express";
import { storage } from "../storage";
import { insertChannelSchema } from "@shared/schema";
import { normalizeUsername } from "../utils/normalize";

export function mountChannels(app: Express) {
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
    } catch (error:any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  app.get("/api/channels/:id", async (req, res) => {
    try {
      const channel = await storage.getChannel(req.params.id);
      if (!channel) return res.status(404).json({ error: "Channel not found" });
      res.json(channel);
    } catch (error:any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  app.post("/api/channels", async (req, res) => {
    try {
      const { sellerId, ...channelData } = req.body;
      if (!sellerId) {
        return res.status(400).json({ error: "Seller ID is required. Please authenticate first." });
      }

      if (channelData.username) {
        channelData.username = normalizeUsername(channelData.username);
      }

      const validatedChannelData = insertChannelSchema.parse(channelData);

      if (validatedChannelData.subscribers < 0) {
        return res.status(400).json({ error: "Subscriber count cannot be negative" });
      }
      if (parseFloat(validatedChannelData.price) < 0) {
        return res.status(400).json({ error: "Price cannot be negative" });
      }

      const usernameRegex = /^[a-z0-9_]{5,32}$/;
      if (!usernameRegex.test(validatedChannelData.username)) {
        return res.status(400).json({ error: "Username must be 5-32 chars (letters, numbers, underscores)" });
      }

      const existingChannel = await storage.getChannelByUsername(validatedChannelData.username);
      if (existingChannel) {
        return res.status(400).json({ error: "Channel username already exists" });
      }

      const channelWithSeller = { ...validatedChannelData, sellerId };
      const channel = await storage.createChannel(channelWithSeller as any);
      res.json(channel);
    } catch (error:any) {
      res.status(400).json({ error: error?.message || "Unknown error" });
    }
  });

  app.patch("/api/channels/:id", async (req, res) => {
    try {
      const { userId, ...updates } = req.body;

      const channel = await storage.getChannel(req.params.id);
      if (!channel) return res.status(404).json({ error: "Channel not found" });

      if (channel.sellerId !== userId) {
        return res.status(403).json({ error: "You can only update your own channels" });
      }

      if (updates.username) {
        updates.username = normalizeUsername(updates.username);
        const usernameRegex = /^[a-z0-9_]{5,32}$/;
        if (!usernameRegex.test(updates.username)) {
          return res.status(400).json({ error: "Username must be 5-32 chars (letters, numbers, underscores)" });
        }
        const existing = await storage.getChannelByUsername(updates.username);
        if (existing && existing.id !== channel.id) {
          return res.status(400).json({ error: "Channel username already exists" });
        }
      }

      if (updates.subscribers !== undefined && updates.subscribers < 0) {
        return res.status(400).json({ error: "Subscriber count cannot be negative" });
      }
      if (updates.price !== undefined && parseFloat(updates.price) < 0) {
        return res.status(400).json({ error: "Price cannot be negative" });
      }

      const updatedChannel = await storage.updateChannel(req.params.id, updates);
      res.json(updatedChannel);
    } catch (error:any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  app.delete("/api/channels/:id", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ error: "User ID is required" });

      const channel = await storage.getChannel(req.params.id);
      if (!channel) return res.status(404).json({ error: "Channel not found" });
      if (channel.sellerId !== userId) {
        return res.status(403).json({ error: "You can only delete your own channels" });
      }

      const activities = await storage.getActivitiesByChannel(req.params.id);
      const recentActivities = activities.filter((a) => {
        const completedTime = new Date(a.completedAt);
        const hoursDiff = (Date.now() - completedTime.getTime()) / (1000 * 3600);
        return hoursDiff < 24;
      });
      if (recentActivities.length > 0) {
        return res.status(400).json({ error: "Cannot delete channel with recent sales activity" });
      }

      await storage.deleteChannel(req.params.id);
      res.json({ success: true });
    } catch (error:any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  app.post("/api/channels/:id/verify", async (req, res) => {
    try {
      const channelId = req.params.id;
      const channel = await storage.updateChannel(channelId, { isVerified: true });
      if (!channel) return res.status(404).json({ error: "Channel not found" });
      res.json({ verified: true, channel });
    } catch (error:any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });
}