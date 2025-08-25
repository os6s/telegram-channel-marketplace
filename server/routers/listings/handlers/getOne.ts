// server/routers/listings/handlers/getOne.ts
import type { Request, Response } from "express";
import { db } from "../../../db.js";
import { eq } from "drizzle-orm";
import { listings, users } from "@shared/schema";

export async function getListing(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    // 🟢 جلب الإعلان
    const rows = await db
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
      })
      .from(listings)
      .where(eq(listings.id, id));

    if (!rows.length) return res.status(404).json({ error: "not_found" });

    const listing = rows[0];

    // 🟢 جلب بيانات البائع
    let seller: { id: string; username: string | null; telegramId: string | null } | null = null;
    if (listing.sellerId) {
      const [u] = await db
        .select({ id: users.id, username: users.username, telegramId: users.telegramId })
        .from(users)
        .where(eq(users.id, listing.sellerId));
      if (u) {
        seller = { id: u.id, username: u.username, telegramId: u.telegramId };
      }
    }

    // 🟢 تجهيز الاستجابة
    res.json({
      ...listing,
      seller,
    });
  } catch (error: any) {
    console.error("getListing error:", error);
    res.status(500).json({ error: error?.message || "Unknown error" });
  }
}