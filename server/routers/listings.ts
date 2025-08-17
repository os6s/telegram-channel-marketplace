// server/routers/listings.ts
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { normalizeUsername } from "../utils/normalize";

const Create = z.object({
  telegramId: z.string().optional(),
  sellerId: z.string().optional(),
  kind: z.literal("channel"),
  platform: z.literal("telegram").optional(),
  channelMode: z.enum(["subscribers","gifts"]).optional(),
  username: z.string().min(5).max(32),
  title: z.string().optional(),
  subscribers: z.coerce.number().int().nonnegative().optional(),
  price: z.union([z.coerce.number().positive(), z.string().regex(/^\d+(\.\d{1,9})?$/)]),
  currency: z.enum(["TON","USDT"]).default("TON"),
  description: z.string().max(2000).optional(),
  isVerified: z.boolean().optional(),
});

export function mountListings(app: Express) {
  app.get("/api/listings", async (req, res) => {
    try {
      const { search = "", sellerId = "", type = "", platform = "", channelMode = "" } =
        req.query as Record<string,string>;

      const channels = await storage.getChannels({
        search: search || undefined,
        sellerId: sellerId || undefined,
      });

      const filtered = channels.filter(c => {
        if (type && type !== "channel") return false;
        if (platform && platform !== "telegram") return false;
        if (channelMode) { /* اربط بحقل إن وُجد */ }
        return true;
      });

      const out = filtered.map(c => ({
        id: c.id,
        sellerId: c.sellerId,
        kind: "channel" as const,
        platform: "telegram" as const,
        channelMode: "subscribers" as const,
        username: c.username,
        title: c.name || c.username,
        subscribers: c.subscribers,
        price: Number(c.price),
        currency: "TON" as const,
        description: c.description || "",
        isVerified: !!c.isVerified,
        createdAt: (c as any).createdAt || new Date().toISOString(),
      }));

      res.json(out);
    } catch (e) {
      res.status(500).json({ error: "Failed to load listings" });
    }
  });

  app.post("/api/listings", async (req, res) => {
    try {
      const body = Create.parse(req.body);

      let sellerId = body.sellerId;
      if (!sellerId && body.telegramId) {
        const u = await storage.getUserByTelegramId(String(body.telegramId));
        if (!u) return res.status(400).json({ error: "User not found. Open app from Telegram first." });
        sellerId = u.id;
      }
      if (!sellerId) return res.status(400).json({ error: "sellerId or telegramId is required" });

      const uname = normalizeUsername(body.username);
      if (!/^[a-z0-9_]{5,32}$/.test(uname)) {
        return res.status(400).json({ error: "Invalid channel username" });
      }
      const dupe = await storage.getChannelByUsername(uname);
      if (dupe) return res.status(400).json({ error: "Channel username already exists" });

      const priceStr = typeof body.price === "number" ? String(body.price) : body.price;
      if (!/^\d+(\.\d{1,9})?$/.test(priceStr)) {
        return res.status(400).json({ error: "Invalid TON amount" });
      }

      const channel = await storage.createChannel({
        sellerId,
        name: body.title || uname,
        username: uname,
        description: body.description || "",
        category: "general",
        subscribers: body.subscribers ?? 0,
        engagement: "0.00",
        price: priceStr,
        isVerified: !!body.isVerified,
        isActive: true,
        avatarUrl: null,
      } as any);

      res.status(201).json({
        id: channel.id,
        sellerId: channel.sellerId,
        kind: "channel",
        platform: "telegram",
        channelMode: "subscribers",
        username: channel.username,
        title: channel.name || channel.username,
        subscribers: channel.subscribers,
        price: Number(channel.price),
        currency: "TON",
        description: channel.description || "",
        isVerified: !!channel.isVerified,
        createdAt: (channel as any).createdAt || new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(400).json({ error: "Invalid payload", issues: error?.issues || null });
    }
  });
}
