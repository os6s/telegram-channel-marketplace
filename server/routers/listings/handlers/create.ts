import type { Request, Response } from "express";
import { db } from "../../../db.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { listings, users } from "@shared/schema";

const createListingSchema = z.object({
  kind: z.enum(["channel","username","account","service"]),
  platform: z.enum(["telegram","twitter","instagram","discord","snapchat","tiktok"]).default("telegram"),
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

const S = (v: unknown) => (v == null ? "" : String(v));
const normHandle = (v?: string) =>
  (v || "").trim().replace(/^@/,"")
  .replace(/^https?:\/\/t\.me\//i,"").replace(/^t\.me\//i,"").toLowerCase();

async function me(req: Request) {
  const tg = req.telegramUser!;
  return (await db.query.users.findFirst({ where: eq(users.telegramId, Number(tg.id)) }))!;
}
const toNumOrNull = (v?: string|number|null) => {
  const s = S(v).trim(); if(!s) return null;
  const n = Number(s); return Number.isFinite(n)? n : null;
};

export async function createListing(req: Request, res: Response) {
  try {
    const user = await me(req);
    if (!user?.id) return res.status(401).json({ error: "unauthorized" });

    const p = createListingSchema.parse(req.body ?? {});
    const unified = p.kind === "service" ? undefined : normHandle(p.username);

    const insert = {
      sellerId: user.id,
      buyerId: null,
      kind: p.kind,
      platform: p.platform,
      username: unified || null,
      title: p.title?.trim() || (unified ? `@${unified}` : `${p.platform} ${p.kind}`),
      description: p.description || null,
      price: S(p.price),
      currency: p.currency || "TON",
      channelMode: p.channelMode || null,
      subscribersCount: toNumOrNull(p.subscribersCount) as any,
      giftsCount: toNumOrNull(p.giftsCount) as any,
      giftKind: p.giftKind || null,
      tgUserType: p.tgUserType || null,
      followersCount: toNumOrNull(p.followersCount) as any,
      accountCreatedAt: p.accountCreatedAt || null,
      serviceType: p.serviceType || null,
      target: p.target || null,
      serviceCount: toNumOrNull(p.serviceCount) as any,
      isActive: true,
      removedByAdmin: false,
      removedReason: null,
    } satisfies typeof listings.$inferInsert;

    const [row] = await db.insert(listings).values(insert).returning();
    res.status(201).json(row);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "invalid_payload" });
  }
}