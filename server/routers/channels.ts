// server/routers/channels.ts
import type { Express } from "express";
import { storage } from "../storage";
import { insertListingSchema } from "@shared/schema";
import { normalizeUsername } from "../utils/normalize";

// helper: Regex ليوزر تيليجرام فقط
const TG_USERNAME_RE = /^[a-z0-9_]{5,32}$/;

export function mountChannels(app: Express) {
  /* ---------------- List ---------------- */
  app.get("/api/channels", async (req, res) => {
    try {
      const filters = {
        category: req.query.category as string | undefined,            // اختياري لو عندك
        minSubscribers: req.query.minSubscribers
          ? parseInt(String(req.query.minSubscribers)) : undefined,
        maxPrice: req.query.maxPrice as string | undefined,
        search: req.query.search as string | undefined,
        sellerId: req.query.sellerId as string | undefined,
      };
      const rows = await storage.getChannels(filters);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  /* ---------------- Get by id ---------------- */
  app.get("/api/channels/:id", async (req, res) => {
    try {
      const row = await storage.getChannel(req.params.id);
      if (!row) return res.status(404).json({ error: "Listing not found" });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  /* ---------------- Create (maps to listings) ---------------- */
  app.post("/api/channels", async (req, res) => {
    try {
      const { sellerId, ...body } = req.body || {};
      if (!sellerId) return res.status(400).json({ error: "Seller ID required" });

      // طبع اليوزرنيم
      const usernameRaw = body.channelUsername ?? body.link ?? body.username ?? "";
      const username = body.kind === "service" ? null : normalizeUsername(usernameRaw);

      // بناء payload متوافق مع insertListingSchema
      const payload = {
        sellerId,
        kind: body.kind,                                  // 'channel' | 'username' | 'account' | 'service'
        platform: body.platform ?? "telegram",
        price: String(body.price ?? "").trim(),
        currency: body.currency ?? "TON",
        description: body.description ?? "",
        isVerified: !!body.isVerified,

        // channel
        channelMode: body.channelMode ?? "subscribers",
        username,
        subscribersCount: body.subscribersCount != null ? Number(body.subscribersCount) : undefined,
        giftsCount: body.giftsCount != null ? Number(body.giftsCount) : undefined,
        giftKind: body.giftKind,

        // username/account
        tgUserType: body.tgUserType,

        // account
        followersCount: body.followersCount != null ? Number(body.followersCount) : undefined,
        createdAt: body.createdAt,                        // YYYY-MM

        // service
        serviceType: body.serviceType,
        target: body.target,
        count: body.count != null ? Number(body.count) : undefined,

        // عنوان اختياري
        title: body.title,
      };

      // تحقق Zod
      const validated = insertListingSchema.parse(payload);

      // تحقق إضافي: يوزر تيليجرام فقط يخضع للـ regex
      if (validated.platform === "telegram" && validated.kind !== "service" && validated.username) {
        if (!TG_USERNAME_RE.test(validated.username)) {
          return res.status(400).json({ error: "Invalid Telegram username format" });
        }
      }

      // منع التكرار على username إن وجد
      if (validated.username) {
        const dupe = await storage.getChannelByUsername(validated.username);
        if (dupe) return res.status(400).json({ error: "Username already exists" });
      }

      const row = await storage.createChannel({ ...validated, sellerId } as any);
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Invalid payload" });
    }
  });

  /* ---------------- Update ---------------- */
  app.patch("/api/channels/:id", async (req, res) => {
    try {
      const { userId, ...updates } = req.body || {};
      const row = await storage.getChannel(req.params.id);
      if (!row) return res.status(404).json({ error: "Listing not found" });
      if (!userId || row.sellerId !== userId) {
        return res.status(403).json({ error: "You can only update your own listings" });
      }

      // طبع اليوزرنيم لو أُرسل
      if (updates.username != null) {
        updates.username = normalizeUsername(updates.username);
        if (row.platform === "telegram" && row.kind !== "service" && updates.username) {
          if (!TG_USERNAME_RE.test(updates.username)) {
            return res.status(400).json({ error: "Invalid Telegram username format" });
          }
        }
        const existing = await storage.getChannelByUsername(updates.username);
        if (existing && existing.id !== row.id) {
          return res.status(400).json({ error: "Username already exists" });
        }
      }

      // تحويلات رقمية وآمنة للأسماء الجديدة
      if (updates.subscribersCount != null && Number(updates.subscribersCount) < 0) {
        return res.status(400).json({ error: "subscribersCount cannot be negative" });
      }
      if (updates.price != null && parseFloat(String(updates.price)) < 0) {
        return res.status(400).json({ error: "Price cannot be negative" });
      }
      if (updates.followersCount != null && Number(updates.followersCount) < 0) {
        return res.status(400).json({ error: "followersCount cannot be negative" });
      }
      if (updates.giftsCount != null && Number(updates.giftsCount) < 0) {
        return res.status(400).json({ error: "giftsCount cannot be negative" });
      }

      const updated = await storage.updateChannel(req.params.id, updates);
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  /* ---------------- Delete ---------------- */
  app.delete("/api/channels/:id", async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      if (!userId) return res.status(400).json({ error: "User ID is required" });

      const row = await storage.getChannel(req.params.id);
      if (!row) return res.status(404).json({ error: "Listing not found" });
      if (row.sellerId !== userId) {
        return res.status(403).json({ error: "You can only delete your own listings" });
      }

      // منع الحذف لو أكو مبيعات حديثة
      const acts = await storage.getActivitiesByChannel(req.params.id); // listingId
      const recent = acts.filter((a) => {
        const t = new Date(a.createdAt as any).getTime();
        return (Date.now() - t) / 36e5 < 24;
      });
      if (recent.length) {
        return res.status(400).json({ error: "Cannot delete listing with recent activity" });
      }

      await storage.deleteChannel(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  /* ---------------- Verify flag ---------------- */
  app.post("/api/channels/:id/verify", async (req, res) => {
    try {
      const row = await storage.updateChannel(req.params.id, { isVerified: true });
      if (!row) return res.status(404).json({ error: "Listing not found" });
      res.json({ verified: true, listing: row });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });
}