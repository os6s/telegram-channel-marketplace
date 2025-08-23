// server/routers/users.ts
import type { Express, Request, Response } from "express";
import { db } from "../db.js";
import { users, insertUserSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { tgOptionalAuth, requireTelegramUser } from "../middleware/tgAuth.js";

/** helper: upsert by telegram_id from req.telegramUser (no duplicates) */
async function getOrCreateCurrent(dbUserReq: Request) {
  const tg = dbUserReq.telegramUser!;
  const tgIdStr = String(tg.id);

  // try existing
  const existing = await db.query.users.findFirst({
    where: eq(users.telegramId, Number(tgIdStr)),
  });
  if (existing) return existing;

  // create
  const payload = insertUserSchema.parse({
    telegramId: tgIdStr,
    username: tg.username || null,
    tonWallet: null,
    walletAddress: null,
  });
  const inserted = await db.insert(users).values({
    telegramId: Number(payload.telegramId),
    username: payload.username ?? null,
    tonWallet: payload.tonWallet ?? null,
    walletAddress: payload.walletAddress ?? null,
    role: "user",
  }).returning();
  return inserted[0];
}

export function mountUsers(app: Express) {
  /** POST /api/users — upsert using Telegram initData (optional body fallback) */
  app.post("/api/users", tgOptionalAuth, async (req: Request, res: Response) => {
    try {
      if (!req.telegramUser?.id) return res.status(401).json({ error: "unauthorized" });
      const me = await getOrCreateCurrent(req);
      return res.json(me);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || "invalid_payload" });
    }
  });

  /** GET /api/me — current user (creates if first time) */
  app.get("/api/me", requireTelegramUser, async (req: Request, res: Response) => {
    const me = await getOrCreateCurrent(req);
    return res.json(me);
    // returns full row including { id, telegramId, username, role, ... }
  });

  /** GET /api/users/by-telegram/:telegramId */
  app.get("/api/users/by-telegram/:telegramId", async (req, res) => {
    const tgId = Number(req.params.telegramId || 0);
    if (!tgId) return res.status(400).json({ error: "telegramId required" });
    const row = await db.query.users.findFirst({ where: eq(users.telegramId, tgId) });
    if (!row) return res.status(404).json({ error: "not_found" });
    res.json(row);
  });

  /** GET /api/users/:id */
  app.get("/api/users/:id", async (req, res) => {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });
    const row = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!row) return res.status(404).json({ error: "not_found" });
    res.json(row);
  });

  /** PATCH /api/users/:id — limited updates (no role changes here) */
  app.patch("/api/users/:id", requireTelegramUser, async (req, res) => {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    const updates: Partial<typeof users.$inferInsert> = {};
    if (typeof req.body?.username === "string") updates.username = req.body.username.trim() || null;
    if (typeof req.body?.walletAddress === "string") updates.walletAddress = req.body.walletAddress.trim() || null;
    if (typeof req.body?.tonWallet === "string") updates.tonWallet = req.body.tonWallet.trim() || null;
    if ("role" in (req.body || {})) return res.status(403).json({ error: "role update not allowed" });

    const updated = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    if (!updated.length) return res.status(404).json({ error: "not_found" });
    res.json(updated[0]);
  });
}