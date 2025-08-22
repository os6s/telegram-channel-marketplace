// server/routers/listings.ts
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";

/* -------- Helpers -------- */
function normUsername(v: unknown) {
  return String(v ?? "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^t\.me\//i, "")
    .toLowerCase();
}

const zStrOrNum = z.union([z.string(), z.number()]).optional();

const createListingSchema = z
  .object({
    sellerId: z.string().uuid().optional(),
    telegramId: z.union([z.string(), z.number()])
      .transform((v) => (v == null ? undefined : String(v)))
      .optional(),

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
    subscribersCount: zStrOrNum,
    giftsCount: zStrOrNum,
    giftKind: z.string().optional(),

    // username
    username: z.string().optional(),
    tgUserType: z.string().optional(),

    // account
    followersCount: zStrOrNum,
    createdAt: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(), // YYYY-MM

    // service
    serviceType: z
      .enum(["followers", "members", "boost_channel", "boost_group"])
      .optional(),
    target: z
      .union([
        z.enum(["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"]),
        z.literal("telegram_channel"),
        z.literal("telegram_group"),
      ])
      .optional(),
    count: zStrOrNum,

    // عنوان اختياري من الفرونت
    title: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const unifiedUsername =
      val.kind === "channel"
        ? normUsername(val.channelUsername || val.link || val.username || "")
        : normUsername(val.username || "");
    if (val.kind !== "service" && !unifiedUsername) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["username"],
        message: "username is required",
      });
    }
  });

/* ---- auth helpers ---- */
async function resolveActor(req: any) {
  const userId = req.query.userId as string | undefined;
  const telegramId = (req.query.telegramId as string | undefined) || undefined;
  if (userId) return storage.getUser(userId);
  if (telegramId) return storage.getUserByTelegramId(String(telegramId));
  return undefined;
}
function isAdmin(u: any | undefined) {
  const uname = (u?.username || "").toLowerCase();
  return u?.role === "admin" || uname === "os6s7";
}

export function mountListings(app: Express) {
  /* إنشاء إعلان */
  app.post("/api/listings", async (req, res) => {
    try {
      const raw = req.body || {};

      const unifiedUsername =
        raw.kind === "channel"
          ? normUsername(raw.channelUsername || raw.link || raw.username || "")
          : normUsername(raw.username || "");

      const parsed = createListingSchema.parse({
        ...raw,
        username: unifiedUsername,
      });

      // البائع: sellerId أو via telegramId
      let sellerId = parsed.sellerId;
      if (!sellerId && parsed.telegramId) {
        const u = await storage.getUserByTelegramId(String(parsed.telegramId));
        if (!u)
          return res
            .status(400)
            .json({ error: "User not found. Open app from Telegram first." });
        sellerId = u.id;
      }
      if (!sellerId) return res.status(400).json({ error: "Missing sellerId" });

      // منع التكرار على username إن وجد
      if (unifiedUsername) {
        const dupe = await storage.getChannelByUsername(unifiedUsername);
        if (dupe) return res.status(400).json({ error: "Username already exists" });
      }

      // أرقام
      const subscribersCount =
        parsed.subscribersCount != null &&
        String(parsed.subscribersCount).trim() !== ""
          ? Number(parsed.subscribersCount)
          : undefined;

      const followersCount =
        parsed.followersCount != null &&
        String(parsed.followersCount).trim() !== ""
          ? Number(parsed.followersCount)
          : undefined;

      const serviceCount =
        parsed.count != null && String(parsed.count).trim() !== ""
          ? Number(parsed.count)
          : undefined;

      // تطبيع target
      let target = parsed.target as any;
      if (target === "telegram_channel" || target === "telegram_group") target = "telegram";

      // عنوان افتراضي
      const title =
        (parsed.title && parsed.title.trim()) ||
        (parsed.kind === "channel"
          ? unifiedUsername
            ? `@${unifiedUsername}`
            : "Channel"
          : parsed.kind === "username"
          ? unifiedUsername || "Username"
          : parsed.kind === "account"
          ? `${parsed.platform || ""} account`.trim()
          : `${parsed.serviceType || "service"} ${target || ""}`.trim());

      // payload لسكيما Drizzle الحالية
      const payload = {
        sellerId,
        kind: parsed.kind,
        platform: parsed.platform ?? "telegram",
        username: unifiedUsername || null,
        title,
        description: parsed.description || "",
        price: parsed.price,
        currency: parsed.currency,
        isVerified: !!parsed.isVerified,
        isActive: true,
        avatarUrl: null,

        // channel
        channelMode: parsed.channelMode,
        subscribersCount,
        giftsCount:
          parsed.giftsCount != null ? Number(parsed.giftsCount) : undefined,
        giftKind: parsed.giftKind,

        // username/account
        tgUserType: parsed.tgUserType,

        // account
        followersCount,
        accountCreatedAt: parsed.createdAt,

        // service
        serviceType: parsed.serviceType,
        target,
        serviceCount,
      };

      const listing = await storage.createChannel(payload as any);
      return res.status(201).json(listing);
    } catch (e: any) {
      console.error("❌ Invalid payload at /api/listings", e?.message);
      return res.status(400).json({
        error: "Invalid payload",
        message: e?.message || "Validation failed",
        issues: e?.issues || null,
      });
    }
  });

  /* جلب كل الإعلانات + فلاتر السوق */
  app.get("/api/listings", async (req, res) => {
    try {
      const search = (req.query.search as string) || undefined;
      const sellerId = (req.query.sellerId as string) || undefined;

      // نجلب من storage أولاً
      const list = await storage.getChannels({ search, sellerId });

      // فلاتر إضافية مطلوبة من الفرونت
      const type = (req.query.type as string) || "";
      const platform = (req.query.platform as string) || "";
      const channelMode = (req.query.channelMode as string) || "";
      const serviceType = (req.query.serviceType as string) || "";

      const filtered = list.filter((it: any) => {
        if (type && (it.kind || "channel") !== type) return false;
        if (platform && (it.platform || "telegram") !== platform) return false;
        if (channelMode && (it.channelMode || "") !== channelMode) return false;
        if (serviceType && (it.serviceType || "") !== serviceType) return false;
        return true;
      });

      res.json(filtered);
    } catch (e: any) {
      console.error("❌ /api/listings error:", e?.message || e);
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  /* جلب إعلان واحد */
  app.get("/api/listings/:id", async (req, res) => {
    try {
      const row = await storage.getChannel(req.params.id);
      if (!row) return res.status(404).json({ error: "Listing not found" });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  /* حذف إعلان (الإدمن أو البائع) */
  app.delete("/api/listings/:id", async (req, res) => {
    try {
      const listing = await storage.getChannel(req.params.id);
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const actor = await resolveActor(req);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });

      const canDelete = isAdmin(actor) || listing.sellerId === actor.id;
      if (!canDelete) return res.status(403).json({ error: "Forbidden" });

      const ok = await storage.deleteChannel(req.params.id);
      if (!ok) return res.status(500).json({ error: "Delete failed" });

      // حذف فعلي سيُشغّل تريغر DB (إن كان مفعّل) لتسجيل removed في activities
      res.json({ success: true, deletedId: req.params.id });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });
}