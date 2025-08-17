import type { Express } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { normalizeUsername } from "../utils/normalize";

// تعريف شكل الإدخال
const Create = z.object({
  telegramId: z.string().optional(),
  sellerId: z.string().optional(),
  kind: z.literal("channel"),
  platform: z.literal("telegram").optional(),
  channelMode: z.enum(["subscribers", "gifts"]).optional(),

  username: z.preprocess(
    (v) => normalizeUsername(String(v ?? "")),
    z.string().regex(/^[a-z0-9_]{5,32}$/, "Invalid channel username")
  ),

  title: z.string().optional(),
  subscribers: z.coerce.number().int().nonnegative().optional(),

  price: z.preprocess(
    (v) => String(v ?? "").trim().replace(",", "."),
    z.string().regex(/^\d+(\.\d{1,9})?$/, "Invalid TON amount")
  ),

  currency: z.enum(["TON", "USDT"]).default("TON"),
  description: z.string().max(2000).optional(),
  isVerified: z.boolean().optional(),
});

export function mountListings(app: Express) {
  // POST /api/listings
  app.post("/api/listings", async (req, res) => {
    try {
      const body = Create.parse(req.body);

      let sellerId = body.sellerId;
      if (!sellerId && body.telegramId) {
        const u = await storage.getUserByTelegramId(String(body.telegramId));
        if (!u) {
          return res
            .status(400)
            .json({ error: "User not found. Open app from Telegram first." });
        }
        sellerId = u.id;
      }
      if (!sellerId)
        return res
          .status(400)
          .json({ error: "sellerId or telegramId is required" });

      const uname = body.username;
      const dupe = await storage.getChannelByUsername(uname);
      if (dupe)
        return res.status(400).json({ error: "Channel username already exists" });

      const priceStr = body.price as unknown as string;

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

      return res.status(201).json({
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
      console.error(
        "Invalid payload /api/listings:",
        req.body,
        error?.issues || error
      );
      return res
        .status(400)
        .json({ error: "Invalid payload", issues: error?.issues || null });
    }
  });

  // GET /api/listings
  app.get("/api/listings", async (req, res) => {
    try {
      const { search = "", sellerId = "" } = req.query as Record<string, string>;
      const channels = await storage.getChannels({
        search: search || undefined,
        sellerId: sellerId || undefined,
      });
      const out = channels.map((c) => ({
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
      console.error("GET /api/listings error:", e);
      res.status(500).json({ error: "Failed to load listings" });
    }
  });
}