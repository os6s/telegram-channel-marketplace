// server/routers/listings.ts
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { tgAuth, tgOptionalAuth } from "../middleware/tgAuth";

/* -------- Helpers -------- */
function normUsername(v: unknown) {
  return String(v ?? "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^t\.me\//i, "")
    .toLowerCase();
}
function normSellerUsername(v: unknown) {
  return String(v ?? "").trim().replace(/^@/, "").toLowerCase();
}

const zStrOrNum = z.union([z.string(), z.number()]).optional();

/* ---- auth helpers ---- */
async function resolveActor(req: any) {
  // أولاً من tgAuth
  const tg = req.telegramUser as { id?: number; username?: string } | undefined;
  if (tg?.id) {
    const u = await storage.getUserByTelegramId(String(tg.id));
    if (u) return u;
    // fallback على username لو ماكو سجل بالـ DB بعد
    if (tg.username) {
      const u2 = await storage.getUserByUsername(tg.username.toLowerCase());
      if (u2) return u2;
    }
  }

  // فfallback أخير: مفاتيح query القديمة (اختياري)
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

const createListingSchema = z
  .object({
    sellerUsername: z.string().optional(),
    telegramId: z.union([z.string(), z.number()]).transform((v) => (v == null ? undefined : String(v))).optional(),
    kind: z.enum(["channel", "username", "account", "service"]),
    platform: z.enum(["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"]).optional(),
    price: z.string().min(1),
    currency: z.enum(["TON", "USDT"]).default("TON"),
    description: z.string().optional(),
    channelMode: z.enum(["subscribers", "gifts"]).optional(),
    link: z.string().optional(),
    channelUsername: z.string().optional(),
    subscribersCount: zStrOrNum,
    giftsCount: zStrOrNum,
    giftKind: z.string().optional(),
    username: z.string().optional(),
    tgUserType: z.string().optional(),
    followersCount: zStrOrNum,
    createdAt: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(), // YYYY-MM
    serviceType: z.enum(["followers", "members", "boost_channel", "boost_group"]).optional(),
    target: z
      .union([
        z.enum(["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"]),
        z.literal("telegram_channel"),
        z.literal("telegram_group"),
      ])
      .optional(),
    count: zStrOrNum,
    title: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const unifiedUsername =
      val.kind === "channel"
        ? normUsername(val.channelUsername || val.link || val.username || "")
        : normUsername(val.username || "");
    if (val.kind !== "service" && !unifiedUsername) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["username"], message: "username is required" });
    }
  });

export function mountListings(app: Express) {
  /* إنشاء إعلان */
  app.post("/api/listings", async (req, res) => {
    try {
      const raw = req.body || {};
      const unifiedUsername =
        raw.kind === "channel"
          ? normUsername(raw.channelUsername || raw.link || raw.username || "")
          : normUsername(raw.username || "");

      const parsed = createListingSchema.parse({ ...raw, username: unifiedUsername });

      // sellerUsername
      let sellerUsername = parsed.sellerUsername ? normSellerUsername(parsed.sellerUsername) : "";
      if (!sellerUsername && parsed.telegramId) {
        const u = await storage.getUserByTelegramId(String(parsed.telegramId));
        if (!u) return res.status(400).json({ error: "User not found. Open app from Telegram first." });
        sellerUsername = normSellerUsername(u.username || "");
      }
      if (!sellerUsername) return res.status(400).json({ error: "Missing sellerUsername" });

      // منع تكرار
      if (unifiedUsername) {
        const dupe = await storage.getChannelByUsername(unifiedUsername);
        if (dupe) return res.status(400).json({ error: "Username already exists" });
      }

      const subscribersCount =
        parsed.subscribersCount != null && String(parsed.subscribersCount).trim() !== ""
          ? Number(parsed.subscribersCount)
          : undefined;
      const followersCount =
        parsed.followersCount != null && String(parsed.followersCount).trim() !== ""
          ? Number(parsed.followersCount)
          : undefined;
      const serviceCount =
        parsed.count != null && String(parsed.count).trim() !== "" ? Number(parsed.count) : undefined;

      let target = parsed.target as any;
      if (target === "telegram_channel" || target === "telegram_group") target = "telegram";

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

      const payload = {
        sellerUsername,
        kind: parsed.kind,
        platform: parsed.platform ?? "telegram",
        username: unifiedUsername || null,
        title,
        description: parsed.description || "",
        price: parsed.price,
        currency: parsed.currency,
        isActive: true,
        channelMode: parsed.channelMode,
        subscribersCount,
        giftsCount: parsed.giftsCount != null ? Number(parsed.giftsCount) : undefined,
        giftKind: parsed.giftKind,
        tgUserType: parsed.tgUserType,
        followersCount,
        accountCreatedAt: parsed.createdAt,
        serviceType: parsed.serviceType,
        target,
        serviceCount,
      };

      const listing = await storage.createChannel(payload as any);
      return res.status(201).json(listing);
    } catch (e: any) {
      console.error("❌ Invalid payload at /api/listings", e?.message);
      return res.status(400).json({ error: "Invalid payload", message: e?.message || "Validation failed", issues: e?.issues || null });
    }
  });

  /* جلب كل الإعلانات */
  app.get("/api/listings", async (req, res) => {
    try {
      const search = (req.query.search as string) || undefined;
      const kind = (req.query.type as string) || undefined;
      const platform = (req.query.platform as string) || undefined;
      const channelMode = (req.query.channelMode as string) || undefined;
      const serviceType = (req.query.serviceType as string) || undefined;
      const sellerUsername = req.query.sellerUsername ? normSellerUsername(req.query.sellerUsername as string) : undefined;
      const minSubscribers = req.query.minSubscribers != null ? Number(req.query.minSubscribers) : undefined;
      const maxPrice = req.query.maxPrice != null ? Number(req.query.maxPrice) : undefined;

      const list = await storage.getChannels({
        search,
        kind: kind as any,
        platform: platform as any,
        channelMode: channelMode as any,
        serviceType: serviceType as any,
        sellerUsername,
        minSubscribers,
        maxPrice,
      });

      res.json(list);
    } catch (e: any) {
      console.error("❌ /api/listings error:", e?.message || e);
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  /* جلب إعلان واحد — يسمح بقراءة هوية المستخدم اختياريًا لتحديد canDelete */
  app.get("/api/listings/:id", tgOptionalAuth, async (req, res) => {
    try {
      const row = await storage.getChannel(req.params.id);
      if (!row) return res.status(404).json({ error: "Listing not found" });

      let canDelete = false;
      const actor = await resolveActor(req);
      if (actor) {
        canDelete = isAdmin(actor) || (actor.username && actor.username.toLowerCase() === (row.sellerUsername || "").toLowerCase());
      }

      res.json({ ...row, canDelete });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  /* حذف إعلان (الإدمن أو البائع) — محمي بـ tgAuth */
  app.delete("/api/listings/:id", tgAuth, async (req, res) => {
    try {
      const listing = await storage.getChannel(req.params.id);
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      const actor = await resolveActor(req);
      if (!actor) return res.status(401).json({ error: "Unauthorized" });

      const actorU = (actor.username || "").toLowerCase();
      const canDelete =
        isAdmin(actor) || (!!actorU && actorU === (listing.sellerUsername || "").toLowerCase());
      if (!canDelete) return res.status(403).json({ error: "Forbidden" });

      const ok = await storage.deleteChannel(req.params.id);
      if (!ok) return res.status(500).json({ error: "Delete failed" });

      res.json({ success: true, deletedId: req.params.id });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });
}