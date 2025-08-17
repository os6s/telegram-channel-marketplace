// server/routers/listings.ts
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";

const createListingSchema = z.object({
  sellerId: z.string().uuid().optional(),
  telegramId: z.string().optional(),        // fallback فقط إذا ما جا sellerId
  kind: z.enum(["channel", "username", "account", "service"]).default("channel"),
  platform: z.enum(["telegram","twitter","instagram","discord","snapchat","tiktok"]).default("telegram"),
  channelMode: z.enum(["subscribers","gifts"]).optional(),
  username: z.string().min(1),
  title: z.string().optional(),
  subscribers: z.number().int().min(0).optional(),
  price: z.string().min(1),
  currency: z.enum(["TON","USDT"]).default("TON"),
  description: z.string().optional(),
  isVerified: z.boolean().optional(),
});

function normUsername(v: string) {
  return String(v || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^t\.me\//i, "")
    .toLowerCase();
}

export function mountListings(app: Express) {
  // إنشاء Listing موحّد
  app.post("/api/listings", async (req, res) => {
    try {
      const raw = { ...req.body, username: normUsername(req.body?.username || "") };
      const data = createListingSchema.parse(raw);

      // حدد المالك
      let sellerId = data.sellerId;
      if (!sellerId && data.telegramId) {
        const u = await storage.getUserByTelegramId(String(data.telegramId));
        if (!u) return res.status(400).json({ error: "User not found. Open app from Telegram first." });
        sellerId = u.id;
      }
      if (!sellerId) return res.status(400).json({ error: "Missing sellerId" });

      // تحقق من عدم تكرار username للقنوات
      if (data.kind === "channel") {
        const dupe = await storage.getChannelByUsername(data.username);
        if (dupe) return res.status(400).json({ error: "Channel username already exists" });
      }

      // بناء سجل القناة فقط (الأنواع الأخرى لاحقاً)
      if (data.kind !== "channel") {
        return res.status(501).json({ error: "Only 'channel' listings are supported for now" });
      }

      const payload = {
        sellerId,
        name: data.username,
        username: data.username,
        description: data.description || "",
        category: "general",
        subscribers: data.subscribers ?? 0,
        engagement: "0.00",
        price: data.price,
        isVerified: !!data.isVerified,
        isActive: true,
        avatarUrl: null as string | null,
      };

      const channel = await storage.createChannel(payload as any);
      return res.json({ ok: true, channel });
    } catch (e: any) {
      return res.status(400).json({ error: "Invalid payload", issues: e?.issues || null });
    }
  });

  // قراءة
  app.get("/api/listings", async (_req, res) => {
    try {
      const list = await storage.getChannels({}); // فلترة بالفرونت حاليًا
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });
}