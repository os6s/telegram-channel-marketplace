// server/routers/users.ts
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { insertUserSchema } from "@shared/schema";
import { tgOptionalAuth } from "../middleware/tgAuth.js";

// helpers
const isDbUniqueError = (e: any) => !!e && (e.code === "23505" || /unique/i.test(String(e.message)));
const normUsername = (v: unknown) => String(v ?? "").trim().replace(/^@/, "").toLowerCase() || null;
const isAdminName = (u?: { username?: string | null; role?: string | null }) =>
  (u?.role === "admin") || ((u?.username || "").toLowerCase() === "os6s7");

export function mountUsers(app: Express) {
  // upsert باستخدام telegramId من initData إن لم يُرسل في البودي
  app.post("/api/users", tgOptionalAuth, async (req: Request, res: Response) => {
    try {
      const tg = (req as any).telegramUser;
      const bodyTelegramId =
        req.body?.telegramId != null ? String(req.body.telegramId) : (tg?.id ? String(tg.id) : "");

      // اشتق اسم بديل إذا ما عنده username في تيليگرام
      let uname = normUsername(req.body?.username ?? tg?.username ?? null);
      if (!uname && bodyTelegramId) uname = `tg_${bodyTelegramId}`;

      const body = {
        ...req.body,
        telegramId: bodyTelegramId,
        username: uname,
      };

      const userData = insertUserSchema.parse(body);
      if (!userData.telegramId) return res.status(401).json({ error: "unauthorized" });

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

  // جلب مستخدم بالـ Telegram ID (للأدوات الخارجية فقط)
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

  // endpoint قديم via query — للتوافق فقط
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

      // منع تغيير telegramId
      if (Object.prototype.hasOwnProperty.call(updates, "telegramId")) {
        return res.status(403).json({ error: "telegramId update not allowed" });
      }

      // تطبيع اليوزرنيم
      if (updates.username !== undefined) {
        updates.username = normUsername(updates.username);
        if (!updates.username) {
          return res.status(400).json({ error: "username cannot be empty" });
        }
      }

      // منع تغيير الدور هنا
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

  // me مبني على initData الموقّعة
  app.get("/api/me", tgOptionalAuth, (req, res) => {
    const tg = (req as any).telegramUser;
    if (!tg?.id) return res.status(401).json({ error: "unauthorized" });
    return res.json({ telegramId: String(tg.id), username: tg.username || null });
  });
}