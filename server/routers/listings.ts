// server/routers/listings.ts
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";

/* -------- Helpers -------- */
function normUsername(v: string) {
  return String(v || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^t\.me\//i, "")
    .toLowerCase();
}

/* -------- Validation -------- */
const createListingSchema = z.object({
  sellerId: z.string().uuid().optional(),
  telegramId: z.string().optional(),

  kind: z.enum(["channel", "username", "account", "service"]),
  platform: z
    .enum(["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"])
    .optional(),
  price: z.string().min(1),
  currency: z.enum(["TON", "USDT"]).default("TON"),
  description: z.string().optional(),
  isVerified: z.boolean().optional(),

  // channel
  channelMode: z.enum(["subscribers", "gifts"]).optional(),
  link: z.string().optional(),
  channelUsername: z.string().optional(),
  subscribersCount: z.string().optional(),
  engagement: z.string().optional(),

  // username
  username: z.string().optional(),
  tgUserType: z.string().optional(),

  // account
  followersCount: z.string().optional(),
  createdAt: z.string().optional(),

  // service
  serviceType: z
    .enum(["followers", "members", "boost_channel", "boost_group"])
    .optional(),
  target: z
    .enum(["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"])
    .optional(),
  count: z.string().optional(),
});

/* -------- Router -------- */
export function mountListings(app: Express) {
  // Create listing for all kinds
  app.post("/api/listings", async (req, res) => {
    try {
      const raw = req.body || {};
      console.log("➡️  /api/listings incoming:", raw);

      const unifiedUsername =
        raw.kind === "channel"
          ? normUsername(raw.channelUsername || raw.link || raw.username || "")
          : normUsername(raw.username || "");

      const parsed = createListingSchema.parse({
        ...raw,
        username: unifiedUsername,
      });

      // resolve seller
      let sellerId = parsed.sellerId;
      if (!sellerId && parsed.telegramId) {
        const u = await storage.getUserByTelegramId(String(parsed.telegramId));
        if (!u) {
          return res
            .status(400)
            .json({ error: "User not found. Open app from Telegram first." });
        }
        sellerId = u.id;
      }
      if (!sellerId) return res.status(400).json({ error: "Missing sellerId" });

      // prevent duplicate username when provided
      if (parsed.username) {
        const dupe = await storage.getChannelByUsername(parsed.username);
        if (dupe) return res.status(400).json({ error: "Username already exists" });
      }

      // numeric coercions
      const subscribers =
        parsed.subscribersCount && parsed.subscribersCount.trim() !== ""
          ? Number(parsed.subscribersCount)
          : undefined;
      const followers =
        parsed.followersCount && parsed.followersCount.trim() !== ""
          ? Number(parsed.followersCount)
          : undefined;
      const serviceCount =
        parsed.count && parsed.count.trim() !== "" ? Number(parsed.count) : undefined;

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

        // channel
        channelMode: parsed.channelMode,
        subscribers,
        engagement: parsed.engagement ?? "0.00",

        // username
        tgUserType: parsed.tgUserType,

        // account
        followersCount: followers,
        accountCreatedAt: parsed.createdAt,

        // service
        serviceType: parsed.serviceType,
        target: parsed.target,
        serviceCount,
      };

      const listing = await storage.createChannel(payload as any);
      return res.json({ ok: true, listing });
    } catch (e: any) {
      console.error("❌ Invalid payload at /api/listings");
      try {
        console.error("Body:", JSON.stringify(req.body, null, 2));
      } catch {}
      console.error("Message:", e?.message);
      if (e?.issues) {
        console.error("Zod issues:", JSON.stringify(e.issues, null, 2));
      } else if (e?.errors) {
        console.error("Errors:", JSON.stringify(e.errors, null, 2));
      } else {
        console.error(e);
      }
      return res.status(400).json({
        error: "Invalid payload",
        message: e?.message || "Validation failed",
        issues: e?.issues || e?.errors || null,
      });
    }
  });

  // Read listings (basic filters)
  app.get("/api/listings", async (req, res) => {
    try {
      const filters = {
        search: (req.query.search as string) || undefined,
        sellerId: (req.query.sellerId as string) || undefined,
        // يمكنك توسيعها لاحقًا: kind, platform, price range...
      };
      const list = await storage.getChannels(filters);
      res.json(list);
    } catch (e: any) {
      console.error("❌ /api/listings error:", e?.message || e);
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });
}