// server/routers/admin.ts
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";

/* ========= الإعداد =========
   لازم تضيف في Render:
   - ADMIN_USERNAME = Os6s7  (أو الاسم الإداري اللي تريده)
   - TELEGRAM_BOT_TOKEN (إذا تريد إشعار تلغرام للبائع عند الحذف)
================================ */

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminEnv = process.env.ADMIN_USERNAME; // إلزامي
  if (!adminEnv) {
    return res.status(500).json({ error: "ADMIN_USERNAME env var is required by admin routes" });
  }
  const caller = String(req.header("x-admin-username") || "");
  if (!caller || caller !== adminEnv) {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

/* ========= إشعار تلغرام اختياري ========= */
async function sendTelegramMessage(telegramId: string | null | undefined, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return; // بدون توكن، نتجاهل الإشعار بهدوء
  const chatId = telegramId ? Number(telegramId) : NaN;
  if (!Number.isFinite(chatId)) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (e) {
    // لا نكسر الطلب بسبب إشعار فاشل
    console.warn("[admin notify] telegram error:", (e as Error)?.message);
  }
}

export function mountAdmin(app: Express) {
  /* --------------------------------------
   * GET /api/admin/stats
   * نظرة سريعة للأرقام
   * ------------------------------------ */
  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    try {
      const s = await storage.getMarketplaceStats();
      res.json(s);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to fetch stats" });
    }
  });

  /* --------------------------------------
   * PATCH /api/admin/listings/:id
   * تعديلات بسيطة (تفعيل/تعطيل/توثيق …)
   * body: { isActive?, isVerified?, title?, price? }
   * ------------------------------------ */
  app.patch("/api/admin/listings/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const allowed: Record<string, any> = {};
      const { isActive, isVerified, title, price } = (req.body || {}) as Record<string, any>;

      if (typeof isActive === "boolean") allowed.isActive = isActive;
      if (typeof isVerified === "boolean") allowed.isVerified = isVerified;
      if (typeof title === "string") allowed.title = title;
      if (price != null) allowed.price = String(price);

      if (Object.keys(allowed).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const updated = await storage.updateChannel(id, allowed);
      if (!updated) return res.status(404).json({ error: "Listing not found" });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to update listing" });
    }
  });

  /* --------------------------------------
   * DELETE /api/admin/listings/:id
   * حذف نهائي مع تأكيد
   * body: { confirm: true, reason?: string }
   * — يرسل إشعار للبائع إذا كان لديه telegramId
   * ------------------------------------ */
  app.delete("/api/admin/listings/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const { confirm, reason } = (req.body || {}) as { confirm?: boolean; reason?: string };
      if (!confirm) return res.status(400).json({ error: "Confirmation required: { confirm: true }" });

      const listing = await storage.getChannel(id);
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      // نفّذ الحذف
      const ok = await storage.deleteChannel(id);
      if (!ok) return res.status(500).json({ error: "Failed to delete listing" });

      // إشعار البائع (اختياري إذا توكن موجود)
      const seller = await storage.getUser(listing.sellerId);
      if (seller?.telegramId) {
        const title =
          listing.title ||
          (listing.username ? `@${listing.username}` : `${listing.platform || ""} ${listing.kind || ""}`.trim());

        const msg = [
          "🗑 <b>Your listing was removed by admin</b>",
          "",
          `<b>Item:</b> ${title}`,
          reason ? `<b>Reason:</b> ${reason}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        await sendTelegramMessage(seller.telegramId, msg);
      }

      res.json({ ok: true, deletedId: id });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to delete listing" });
    }
  });
}