// server/routers/admin-payouts.ts
import type { Express, Request } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { users, type User } from "@shared/schema";
import { eq } from "drizzle-orm";
import { tgAuth } from "../middleware/tgAuth";

/* --- auth موحّد مع admin.ts --- */
const ADMIN_TG = new Set(
  (process.env.ADMIN_TG_IDS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
);

async function resolveActor(req: Request): Promise<User | undefined> {
  const tg = (req as any).telegramUser as { id: number } | undefined;
  if (!tg) return undefined;
  return storage.getUserByTelegramId(String(tg.id));
}
function isAdmin(u?: Pick<User, "role" | "telegramId" | "username">) {
  if (!u) return false;
  if (u.role === "admin") return true;
  const ok = u.telegramId ? ADMIN_TG.has(u.telegramId) : false;
  return ok || (u.username || "").toLowerCase() === "os6s7";
}

export function mountAdminPayouts(app: Express) {
  // GET /api/admin/payouts?sellerId=&status=&limit=&offset=
  app.get("/api/admin/payouts", tgAuth, async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    const sellerId = req.query.sellerId ? String(req.query.sellerId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    let rows = sellerId ? await storage.listPayoutsBySeller(sellerId) : [];
    if (status) rows = rows.filter(p => p.status === status);

    rows.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());

    const limit = Math.max(0, Number(req.query.limit ?? 50));
    const offset = Math.max(0, Number(req.query.offset ?? 0));
    res.json(rows.slice(offset, offset + (limit || 50)));
  });

  // PATCH /api/admin/payouts/:id/approve
  app.patch("/api/admin/payouts/:id/approve", tgAuth, async (req, res) => {
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
    res.json(up);
  });

  // PATCH /api/admin/payouts/:id/reject
  app.patch("/api/admin/payouts/:id/reject", tgAuth, async (req, res) => {
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
    res.json(up);
  });
}