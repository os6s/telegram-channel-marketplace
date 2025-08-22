// server/routers/admin-payouts.ts
import type { Express, Request } from "express";
import { desc, eq, and } from "drizzle-orm";
import { db } from "../db";
import { payouts, type Payout } from "@shared/schema";
import { storage } from "../storage";
import { tgAuth } from "../middleware/tgAuth";

/* --- Admin auth helpers --- */
const ADMIN_TG = new Set(
  (process.env.ADMIN_TG_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

async function resolveActor(req: Request) {
  const tg = (req as any).telegramUser as { id: number } | undefined;
  if (!tg) return undefined;
  return storage.getUserByTelegramId(String(tg.id));
}
function isAdmin(u?: { role?: string; telegramId?: string | null; username?: string | null }) {
  if (!u) return false;
  if (u.role === "admin") return true;
  const byTg = u.telegramId ? ADMIN_TG.has(u.telegramId) : false;
  return byTg || (u.username || "").toLowerCase() === "os6s7";
}

export function mountAdminPayouts(app: Express) {
  /**
   * GET /api/admin/payouts?sellerId=&status=&limit=&offset=
   * - إذا وُجد sellerId نستخدم storage.listPayoutsBySeller
   * - إذا لم يوجد، نجلب كل الـ payouts من DB مع فلترة status (إن وُجد)
   */
  app.get("/api/admin/payouts", tgAuth, async (req, res) => {
    try {
      const actor = await resolveActor(req);
      if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

      const sellerId = req.query.sellerId ? String(req.query.sellerId) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;

      const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)));
      const offset = Math.max(0, Number(req.query.offset ?? 0));

      let rows: Payout[] = [];

      if (sellerId) {
        rows = await storage.listPayoutsBySeller(sellerId);
        if (status) rows = rows.filter((p) => p.status === status);
        rows.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());
        return res.json(rows.slice(offset, offset + limit));
      }

      const conds = [];
      if (status) conds.push(eq(payouts.status, status));
      const where = conds.length ? and(...conds) : undefined;

      const all = await db
        .select()
        .from(payouts)
        .where(where as any)
        .orderBy(desc(payouts.createdAt))
        .limit(limit)
        .offset(offset);

      return res.json(all as Payout[]);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Failed to load payouts" });
    }
  });

  /** PATCH /api/admin/payouts/:id/approve  { txHash, checklist? } */
  app.patch("/api/admin/payouts/:id/approve", tgAuth, async (req, res) => {
    try {
      const actor = await resolveActor(req);
      if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

      const id = req.params.id;
      const txHash = String(req.body?.txHash || "");
      const checklist = String(req.body?.checklist || "manual-checked");
      if (txHash.length < 16) return res.status(400).json({ error: "tx_hash_required" });

      const cur = await storage.getPayout(id);
      if (!cur) return res.status(404).json({ error: "not_found" });
      if (cur.status !== "queued") return res.status(409).json({ error: `invalid_state_${cur.status}` });

      const up = await storage.updatePayout(id, {
        status: "sent",
        adminChecked: true,
        txHash,
        checklist,
        sentAt: new Date() as any,
      });
      return res.json(up);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Approve failed" });
    }
  });

  /** PATCH /api/admin/payouts/:id/reject  { reason? } */
  app.patch("/api/admin/payouts/:id/reject", tgAuth, async (req, res) => {
    try {
      const actor = await resolveActor(req);
      if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

      const id = req.params.id;
      const reason = String(req.body?.reason || "rejected");

      const cur = await storage.getPayout(id);
      if (!cur) return res.status(404).json({ error: "not_found" });
      if (cur.status !== "queued") return res.status(409).json({ error: `invalid_state_${cur.status}` });

      const up = await storage.updatePayout(id, {
        status: "rejected",
        adminChecked: true,
        checklist: reason,
      });
      return res.json(up);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Reject failed" });
    }
  });
}