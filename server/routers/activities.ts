// server/routers/activities.ts
import type { Express } from "express";
import { storage } from "../storage";
import { insertActivitySchema } from "@shared/schema";

export function mountActivities(app: Express) {
  app.get("/api/activities", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const channelId = req.query.channelId as string;

      let activities;
      if (userId) activities = await storage.getActivitiesByUser(userId);
      else if (channelId) activities = await storage.getActivitiesByChannel(channelId);
      else return res.status(400).json({ error: "userId or channelId required" });

      res.json(activities);
    } catch (error:any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  app.get("/api/activities/:id", async (req, res) => {
    try {
      const activity = await storage.getActivity(req.params.id);
      if (!activity) return res.status(404).json({ error: "Activity not found" });
      res.json(activity);
    } catch (error:any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  app.post("/api/activities", async (req, res) => {
    try {
      const activityData = insertActivitySchema.parse(req.body);

      const channel = await storage.getChannel(activityData.channelId);
      if (!channel || !channel.isActive) {
        return res.status(400).json({ error: "Channel not found or inactive" });
      }

      if (parseFloat(activityData.amount) !== parseFloat(channel.price)) {
        return res.status(400).json({ error: "Amount does not match channel price" });
      }

      const activity = await storage.createActivity(activityData);
      res.json(activity);
    } catch (error:any) {
      res.status(400).json({ error: error?.message || "Unknown error" });
    }
  });

  app.patch("/api/activities/:id", async (req, res) => {
    try {
      const updates = req.body;
      const activity = await storage.updateActivity(req.params.id, updates);
      if (!activity) return res.status(404).json({ error: "Activity not found" });
      res.json(activity);
    } catch (error:any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });
}