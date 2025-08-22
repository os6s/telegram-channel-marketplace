// server/routers/users.ts
import type { Express } from "express";
import { storage } from "../storage";
import { insertUserSchema } from "@shared/schema";

// helpers
const isDbUniqueError = (e: any) =>
  !!e && (e.code === "23505" || /unique/i.test(String(e.message)));

const normUsername = (v: unknown) =>
  String(v ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase() || null;

// بسيط: اعتبر "os6s7" إدمن إن احتجنا فحص لاحقاً
const isAdminName = (u?: { username?: string | null; role?: string | null }) =>
  (u?.role === "admin") || ((u?.username || "").toLowerCase() === "os6s7");

export function mountUsers(app: Express) {
  // upsert بالـ telegramId
  app.post("/api/users", async (req, res) => {
    try {
      const body = {
        ...req.body,
        telegramId: String(req.body?.telegramId ?? ""),
        username: normUsername(req.body?.username),
      };

      const userData = insertUserSchema.parse(body);

      if (!userData.telegramId) {
        return res.status(400).json({ error: "telegramId required" });
      }

      const existing = await storage.getUserByTelegramId(userData.telegramId);
      if (existing) return res.json(existing);

      try {
        const created = await storage.createUser(userData);
        return res.json(created);
      } catch (e: any) {
        if (isDbUniqueError(e)) {
          const fallback = await storage.getUserByTelegramId(userData.telegramId);
          if (fallback) return res.json(fallback);
        }
        throw e;
      }
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || "Invalid payload" });
    }
  });

  // جلب مستخدم بالـ Telegram ID (مفيد للفرونت)
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

  // جلب بالـ id الداخلي
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  // endpoint قديم via query
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
      const updates: any = { ...req.body };

      // طبّع اليوزرنيم
      if (updates.username !== undefined) {
        updates.username = normUsername(updates.username);
      }

      // منع تغيير الدور عبر هذا المسار
      if (Object.prototype.hasOwnProperty.call(updates, "role")) {
        return res.status(403).json({ error: "role update not allowed here" });
      }

      const user = await storage.updateUser(req.params.id, updates);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Invalid payload" });
    }
  });

  // نقطة مساعدة: me عبر telegramId كـ query (بدون auth معقد حالياً)
  app.get("/api/me", async (req, res) => {
    try {
      const telegramId = String(req.query.telegramId || "");
      if (!telegramId) return res.status(400).json({ error: "telegramId required" });
      const me = await storage.getUserByTelegramId(telegramId);
      if (!me) return res.status(404).json({ error: "User not found" });
      res.json(me);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });
}