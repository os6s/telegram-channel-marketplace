// server/routers/admin-payouts.ts
import type { Express, Request } from "express";
import { desc, eq, and } from "drizzle-orm";
import { z } from "zod";
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

/* --- Schemas --- */
const listQuery = z.object({
  sellerId: z.string().uuid().optional(),
  status: z.enum(["queued", "sent", "confirmed", "failed", "rejected"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const approveBody = z.object({
  txHash: z.string().min(16),
  checklist: z.string().optional(),
});

const rejectBody = z.object({
  reason: z.string().min(1).default("rejected"),
});

export function mountAdminPayouts(app: Express) {
  /**
   * GET /api/admin/payouts?sellerId=&status=&limit=&offset=
   */
  app.get("/api/admin/payouts", tgAuth, async (req, res) => {
    try {
      const actor = await resolveActor(req);
      if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

      const { sellerId, status, limit, offset } = listQuery.parse(req.query);

      if (sellerId) {
        let rows = await storage.listPayoutsBySeller(sellerId);
        if (status) rows = rows.filter((p) => p.status === status);
        rows.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());
        return res.json(rows.slice(offset, offset + limit));
      }

      const conds: any[] = [];
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
      return res.status(400).json({ error: e?.message || "Invalid query" });
    }
  });

  /** PATCH /api/admin/payouts/:id/approve  { txHash, checklist? } */
  app.patch("/api/admin/payouts/:id/approve", tgAuth, async (req, res) => {
    try {
      const actor = await resolveActor(req);
      if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

      const { txHash, checklist } = approveBody.parse(req.body);

      const cur = await storage.getPayout(req.params.id);
      if (!cur) return res.status(404).json({ error: "not_found" });

      if (cur.status !== "queued") {
        return res.status(409).json({ error: `invalid_state_${cur.status}` });
      }

      const up = await storage.updatePayout(req.params.id, {
        status: "sent",
        adminChecked: true,
        txHash,
        checklist: checklist || "manual-checked",
        sentAt: new Date() as any,
      });

      return res.json(up);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ error: "Invalid payload", issues: e.issues });
      return res.status(500).json({ error: e?.message || "Approve failed" });
    }
  });

  /** PATCH /api/admin/payouts/:id/reject  { reason? } */
  app.patch("/api/admin/payouts/:id/reject", tgAuth, async (req, res) => {
    try {
      const actor = await resolveActor(req);
      if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

      const { reason } = rejectBody.parse(req.body);

      const cur = await storage.getPayout(req.params.id);
      if (!cur) return res.status(404).json({ error: "not_found" });
      if (cur.status !== "queued") return res.status(409).json({ error: `invalid_state_${cur.status}` });

      const up = await storage.updatePayout(req.params.id, {
        status: "rejected",
        adminChecked: true,
        checklist: reason,
      });

      return res.json(up);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ error: "Invalid payload", issues: e.issues });
      return res.status(500).json({ error: e?.message || "Reject failed" });
    }
  });
}