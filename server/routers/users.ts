// server/routers/users.ts
import type { Express } from "express";
import { storage } from "../storage";
import { insertUserSchema } from "@shared/schema";

export function mountUsers(app: Express) {
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByTelegramId(userData.telegramId);
      if (existingUser) return res.json(existingUser);
      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error:any) {
      res.status(400).json({ error: error?.message || "Unknown error" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (error:any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const telegramId = req.query.telegramId as string;
      if (!telegramId) return res.status(400).json({ error: "telegramId parameter required" });
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (error:any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updates = req.body;
      const user = await storage.updateUser(req.params.id, updates);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (error:any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });
}