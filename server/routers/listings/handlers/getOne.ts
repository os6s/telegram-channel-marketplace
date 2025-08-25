import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../../db.js";
import { listings, users } from "@shared/schema";

export async function getListing(req: Request, res: Response) {
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
      sellerUsername: users.username,       // 👈 يوزر البائع
      sellerTelegramId: users.telegramId,   // 👈 تيليجرام آي دي
    })
    .from(listings)
    .leftJoin(users, eq(users.id, listings.sellerId))
    .where(eq(listings.id, id));

  if (!row.length) return res.status(404).json({ error: "not_found" });
  res.json(row[0]);
}