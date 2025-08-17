// server/routers/listings.ts
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";

const createListingSchema = z.object({
  sellerId: z.string().uuid().optional(),
  telegramId: z.string().optional(),

  kind: z.enum(["channel","username","account","service"]),
  platform: z.enum(["telegram","twitter","instagram","discord","snapchat","tiktok"]).optional(),
  price: z.string().min(1),
  currency: z.enum(["TON","USDT"]).default("TON"),
  description: z.string().optional(),
  isVerified: z.boolean().optional(),

  // channel
  channelMode: z.enum(["subscribers","gifts"]).optional(),
  link: z.string().optional(),
  channelUsername: z.string().optional(),
  subscribersCount: z.string().optional(), // يأتي نص
  engagement: z.string().optional(),

  // username
  username: z.string().optional(),
  tgUserType: z.string().optional(),

  // account
  followersCount: z.string().optional(),
  createdAt: z.string().optional(),

  // service
  serviceType: z.enum(["followers","members","boost_channel","boost_group"]).optional(),
  target: z.enum(["telegram","twitter","instagram","discord","snapchat","tiktok"]).optional(),
  count: z.string().optional(),
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
  app.post("/api/listings", async (req, res) => {
    try {
      const raw = req.body || {};
      const unifiedUsername =
        raw.kind === "channel"
          ? normUsername(raw.channelUsername || raw.link || raw.username || "")
          : normUsername(raw.username || "");
      const parsed = createListingSchema.parse({ ...raw, username: unifiedUsername });

      // resolve seller
      let sellerId = parsed.sellerId;
      if (!sellerId && parsed.telegramId) {
        const u = await storage.getUserByTelegramId(String(parsed.telegramId));
        if (!u) return res.status(400).json({ error: "User not found. Open app from Telegram first." });
        sellerId = u.id;
      }
      if (!sellerId) return res.status(400).json({ error: "Missing sellerId" });

      // منع تكرار اسم المعروض لما يكون username أساسي
      if (parsed.username) {
        const dupe = await storage.getChannelByUsername(parsed.username);
        if (dupe) return res.status(400).json({ error: "Username already exists" });
      }

      // حوّل أرقام نصية
      const subscribers = parsed.subscribersCount ? Number(parsed.subscribersCount) : undefined;
      const followers = parsed.followersCount ? Number(parsed.followersCount) : undefined;
      const serviceCount = parsed.count ? Number(parsed.count) : undefined;

      // حمولة موحّدة إلى جدول channels
      const payload = {
        sellerId,
        kind: parsed.kind,
        platform: parsed.platform ?? "telegram",
        username: parsed.username || "listing_" + Date.now(),
        title: raw.title ?? null,
        description: parsed.description || "",
        price: parsed.price,
        currency: parsed.currency,
        isVerified: !!parsed.isVerified,
        isActive: true,
        avatarUrl: null,

        channelMode: parsed.channelMode,
        subscribers: subscribers,
        engagement: parsed.engagement ?? "0.00",

        tgUserType: parsed.tgUserType,
        followersCount: followers,
        accountCreatedAt: parsed.createdAt,

        serviceType: parsed.serviceType,
        target: parsed.target,
        serviceCount: serviceCount,
      };

      const channel = await storage.createChannel(payload as any);
      return res.json({ ok: true, listing: channel });
    } catch (e: any) {
      return res.status(400).json({ error: "Invalid payload", issues: e?.issues || null });
    }
  });

  // قراءة السوق
  app.get("/api/listings", async (req, res) => {
    try {
      const filters = {
        search: (req.query.search as string) || undefined,
        sellerId: (req.query.sellerId as string) || undefined,
        // بإمكانك توسيع الفلاتر لاحقًا حسب kind/platform...
      };
      const list = await storage.getChannels(filters);
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });
}