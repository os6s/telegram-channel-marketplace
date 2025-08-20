// server/routers/admin-payouts.ts
import type { Express, Request } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { users, type User } from "@shared/schema";

/* auth مبسّط مطابق لـ admin.ts */
async function resolveActor(req: Request): Promise<User | undefined> {
  const userId = (req as any)?.session?.userId || (req.query.userId as string | undefined);
  const telegramId = req.query.telegramId as string | undefined;
  if (userId) return (await db.select().from(users).where(users.id.eq(userId)).limit(1))[0];
  if (telegramId) return (await db.select().from(users).where(users.telegramId.eq(telegramId)).limit(1))[0];
  return undefined;
}
function isAdmin(u?: Pick<User, "role" | "username">) {
  const uname = (u?.username ?? "").toLowerCase();
  return u?.role === "admin" || uname === "os6s7";
}

export function mountAdminPayouts(app: Express) {
  // GET /api/admin/payouts?sellerId=&status=&limit=&offset=
  app.get("/api/admin/payouts", async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    const sellerId = req.query.sellerId ? String(req.query.sellerId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    let rows = sellerId ? await storage.listPayoutsBySeller(sellerId) : [];
    if (status) rows = rows.filter(p => p.status === status);
    // ترتيب أحدث أولاً
    rows.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());

    const limit = Math.max(0, Number(req.query.limit ?? 50));
    const offset = Math.max(0, Number(req.query.offset ?? 0));
    return res.json(rows.slice(offset, offset + (limit || 50)));
  });

  // PATCH /api/admin/payouts/:id/approve
  app.patch("/api/admin/payouts/:id/approve", async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    const id = req.params.id;
    const txHash = String(req.body?.txHash || "");
    const checklist = String(req.body?.checklist || "manual-checked");
    if (txHash.length < 16) return res.status(400).json({ error: "tx_hash_required" });

    const cur = await storage.updatePayout(id, {}); // fetch
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
  });

  // PATCH /api/admin/payouts/:id/reject
  app.patch("/api/admin/payouts/:id/reject", async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    const id = req.params.id;
    const reason = String(req.body?.reason || "rejected");

    const cur = await storage.updatePayout(id, {}); // fetch
    if (!cur) return res.status(404).json({ error: "not_found" });
    if (cur.status !== "queued") return res.status(409).json({ error: `invalid_state_${cur.status}` });

    const up = await storage.updatePayout(id, {
      status: "rejected",
      adminChecked: true,
      checklist: reason,
    });
    return res.json(up);
  });
}