// server/routers/users.ts
import type { Express } from "express";
import { storage } from "../storage";
import { insertUserSchema } from "@shared/schema";

// بديل محلي لفحص unique_violation (23505) حتى ما نعتمد على ../db
const isDbUniqueError = (e: any) =>
  !!e && (e.code === "23505" || /unique/i.test(String(e.message)));

export function mountUsers(app: Express) {
  // إنشاء أو إرجاع الموجود (upsert بالمنطق)
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse({
        ...req.body,
        telegramId: String(req.body?.telegramId ?? ""),
      });

      const existing = await storage.getUserByTelegramId(userData.telegramId);
      if (existing) return res.json(existing);

      const created = await storage.createUser(userData);
      return res.json(created);
    } catch (e: any) {
      // سباق إنشاء مزدوج
      if (isDbUniqueError(e)) {
        try {
          const fallback = await storage.getUserByTelegramId(String(req.body?.telegramId ?? ""));
          if (fallback) return res.json(fallback);
        } catch {}
      }
      return res.status(400).json({ error: e?.message || "Invalid payload" });
    }
  });

  // جلب بالـ Telegram ID (للاستخدام من الفرونت بسهولة)
  app.get("/api/users/by-telegram/:telegramId", async (req, res) => {
    try {
      const telegramId = String(req.params.telegramId || "");
      if (!telegramId) return res.status(400).json({ error: "telegramId required" });
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  // جلب بـ id الداخلي
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  // بديل قديم للاستعلام بالـ query
  app.get("/api/users", async (req, res) => {
    try {
      const telegramId = String(req.query.telegramId || "");
      if (!telegramId) return res.status(400).json({ error: "telegramId parameter required" });
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  // تحديث المستخدم
  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updates = req.body || {};
      const user = await storage.updateUser(req.params.id, updates);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });
}