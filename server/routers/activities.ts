// server/routers/activities.ts
import type { Express } from "express";
import { storage } from "../storage";
import { insertActivitySchema } from "@shared/schema";

/**
 * Endpoints:
 * GET  /api/activities?userId=... | listingId=...
 * GET  /api/activities/:id
 * POST /api/activities           { listingId, buyerId, [sellerId], [amount], [currency], ... }
 * PATCH /api/activities/:id       partial updates
 */
export function mountActivities(app: Express) {
  // List activities by user or listing
  app.get("/api/activities", async (req, res) => {
    try {
      const userId = (req.query.userId as string) || "";
      const listingId = (req.query.listingId as string) || "";

      let rows;
      if (userId) rows = await storage.getActivitiesByUser(userId);
      else if (listingId) rows = await storage.getActivitiesByChannel(listingId); // نفس الدالة لكن id = listingId
      else return res.status(400).json({ error: "userId or listingId required" });

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  // Get activity by id
  app.get("/api/activities/:id", async (req, res) => {
    try {
      const activity = await storage.getActivity(req.params.id);
      if (!activity) return res.status(404).json({ error: "Activity not found" });
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });

  // Create activity (buy/confirm/cancel/…)
  app.post("/api/activities", async (req, res) => {
    try {
      // نقرأ الجسم أولًا بدون رفض، حتى نضيف قيم من الـ listing ثم نتحقق بالـ schema
      const incoming = { ...(req.body || {}) };

      // لازم listingId موجود
      if (!incoming.listingId) return res.status(400).json({ error: "listingId required" });

      // جِب الـ listing وتأكد نشِط
      const listing = await storage.getChannel(incoming.listingId);
      if (!listing || !listing.isActive) {
        return res.status(400).json({ error: "Listing not found or inactive" });
      }

      // حقول افتراضية من الـ listing
      if (!incoming.sellerId) incoming.sellerId = listing.sellerId;
      if (!incoming.amount)   incoming.amount   = String(listing.price);
      if (!incoming.currency) incoming.currency = listing.currency || "TON";

      // تحقق من تطابق السعر إذا أُرسل
      if (incoming.amount != null) {
        const a = parseFloat(String(incoming.amount).replace(",", "."));
        const p = parseFloat(String(listing.price).replace(",", "."));
        if (Number.isFinite(a) && Number.isFinite(p) && a !== p) {
          return res.status(400).json({ error: "Amount does not match listing price" });
        }
      }

      // تحقق نهائي عبر الـ schema
      const activityData = insertActivitySchema.parse(incoming);

      // خزّن
      const activity = await storage.createActivity(activityData);
      res.status(201).json(activity);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Invalid payload" });
    }
  });

  // Update activity
  app.patch("/api/activities/:id", async (req, res) => {
    try {
      const updates = req.body || {};
      const activity = await storage.updateActivity(req.params.id, updates);
      if (!activity) return res.status(404).json({ error: "Activity not found" });
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Unknown error" });
    }
  });
}