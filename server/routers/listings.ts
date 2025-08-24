// server/routers/listings.ts
import type { Express, Request, Response } from "express";
import { db } from "../db.js";
import { and, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { requireTelegramUser } from "../middleware/tgAuth.js";

import {
  listings,
  users,
  marketListingsView,
} from "@shared/schema";

/* ===== Zod: create listing (sellerId from auth, not body) ===== */
const createListingSchema = z.object({
  kind: z.enum(["channel", "username", "account", "service"]),
  platform: z
    .enum(["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"])
    .default("telegram"),
  username: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.string().regex(/^[0-9]+(\.[0-9]+)?$/),
  currency: z.string().default("TON"),
  channelMode: z.string().optional(),
  subscribersCount: z.union([z.string(), z.number()]).optional(),
  giftsCount: z.union([z.string(), z.number()]).optional(),
  giftKind: z.string().optional(),
  tgUserType: z.string().optional(),
  followersCount: z.union([z.string(), z.number()]).optional(),
  accountCreatedAt: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  serviceType: z.string().optional(),
  target: z.string().optional(),
  serviceCount: z.union([z.string(), z.number()]).optional(),
});

/* ===== Helpers ===== */
const S = (v: unknown) => (v == null ? "" : String(v));
const normHandle = (v?: string) =>
  (v || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^t\.me\//i, "")
    .toLowerCase();

async function currentUserRow(req: Request) {
  const meTg = req.telegramUser!;
  return (await db.query.users.findFirst({ where: eq(users.telegramId, Number(meTg.id)) }))!;
}

function toNumberOrNull(v?: string | number | null) {
  if (v == null || S(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ===== Routes ===== */
export function mountListings(app: Express) {
  /** POST /api/listings — create (seller = current user) */
  app.post("/api/listings", requireTelegramUser, async (req: Request, res: Response) => {
    try {
      const me = await currentUserRow(req);
      if (!me?.id) return res.status(401).json({ error: "unauthorized" });

      const parsed = createListingSchema.parse(req.body ?? {});
      const unifiedUsername =
        parsed.kind === "service" ? undefined : normHandle(parsed.username);

      const insert = {
        sellerId: me.id,
        buyerId: null,
        kind: parsed.kind,
        platform: parsed.platform,
        username: unifiedUsername || null,
        title:
          parsed.title?.trim() ||
          (unifiedUsername ? `@${unifiedUsername}` : `${parsed.platform} ${parsed.kind}`),
        description: parsed.description || null,
        price: S(parsed.price),
        currency: parsed.currency || "TON",
        channelMode: parsed.channelMode || null,
        subscribersCount: toNumberOrNull(parsed.subscribersCount) as any,
        giftsCount: toNumberOrNull(parsed.giftsCount) as any,
        giftKind: parsed.giftKind || null,
        tgUserType: parsed.tgUserType || null,
        followersCount: toNumberOrNull(parsed.followersCount) as any,
        accountCreatedAt: parsed.accountCreatedAt || null,
        serviceType: parsed.serviceType || null,
        target: parsed.target || null,
        serviceCount: toNumberOrNull(parsed.serviceCount) as any,
        isActive: true,
        removedByAdmin: false,
        removedReason: null,
      } satisfies typeof listings.$inferInsert;

      const created = await db.insert(listings).values(insert).returning();
      return res.status(201).json(created[0]);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || "invalid_payload" });
    }
  });

  /** GET /api/listings — يستخدم الفيو market_listings */
  app.get("/api/listings", async (req: Request, res: Response) => {
    try {
      const search = (req.query.search as string) || "";
      const kind = (req.query.kind as string) || (req.query.type as string) || "";
      const platform = (req.query.platform as string) || "";
      const onlyActive = req.query.active !== "0"; // default true
      const seller = (req.query.seller as string) || (req.query.sellerUsername as string) || "";

      const whereParts: any[] = [];

      if (search) {
        whereParts.push(
          ilike(marketListingsView.title, `%${search}%`),
          ilike(marketListingsView.username, `%${search.replace(/^@/, "")}%`)
        );
      }
      if (kind) whereParts.push(eq(marketListingsView.kind, kind));
      if (platform) whereParts.push(eq(marketListingsView.platform, platform));
      if (onlyActive) whereParts.push(eq(marketListingsView.isActive, true));

      // seller filter (يُضاف فقط عند وجود قيمة)
      if (seller && seller.trim() !== "") {
        const s = seller.trim().replace(/^@/, "").toLowerCase();
        // تطابق تام
        whereParts.push(eq(marketListingsView.seller, s));
        // لو تريد contains بدلًا من التطابق التام، استبدل بالسطر التالي:
        // whereParts.push(ilike(marketListingsView.seller, `%${s}%`));
      }

      const rows = await db
        .select()
        .from(marketListingsView)
        .where(whereParts.length ? and(...whereParts) : undefined)
        .orderBy(desc(marketListingsView.createdAt));

      return res.json(rows);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "unknown_error" });
    }
  });

  /** GET /api/listings/:id — single (join للحصول على sellerUsername) */
  app.get("/api/listings/:id", async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    const row = await db
      .select({
        id: listings.id,
        kind: listings.kind,
        platform: listings.platform,
        username: listings.username,
        title: listings.title,
        description: listings.description,
        price: listings.price,
        currency: listings.currency,
        isActive: listings.isActive,
        createdAt: listings.createdAt,
        sellerId: listings.sellerId,
        sellerUsername: users.username,
      })
      .from(listings)
      .leftJoin(users, eq(users.id, listings.sellerId))
      .where(eq(listings.id, id));

    if (!row.length) return res.status(404).json({ error: "not_found" });
    return res.json(row[0]);
  });

  /** DELETE /api/listings/:id — owner or admin/moderator */
  app.delete("/api/listings/:id", requireTelegramUser, async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    const me = await currentUserRow(req);
    const listing = await db.query.listings.findFirst({ where: eq(listings.id, id) });
    if (!listing) return res.status(404).json({ error: "not_found" });

    const amOwner = listing.sellerId === me.id;
    const amAdmin = me.role === "admin" || me.role === "moderator";
    if (!amOwner && !amAdmin) return res.status(403).json({ error: "forbidden" });

    await db.delete(listings).where(eq(listings.id, id));
    return res.json({ success: true, deletedId: id });
  });
}