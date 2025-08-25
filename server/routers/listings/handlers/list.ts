import type { Request, Response } from "express";
import { db } from "../../../db.js";
import { and, desc, eq, ilike, or, inArray } from "drizzle-orm";
import { marketListingsView, users } from "@shared/schema";

export async function listListings(req: Request, res: Response) {
  try {
    const search = (req.query.search as string) || "";
    const kind = (req.query.kind as string) || (req.query.type as string) || "";
    const platform = (req.query.platform as string) || "";
    const onlyActive = req.query.active !== "0";
    const seller = (req.query.seller as string) || (req.query.sellerUsername as string) || "";

    const conds: any[] = [];

    // 🔍 فلترة البحث
    if (search) {
      const s = search.replace(/^@/, "");
      conds.push(
        or(
          ilike(marketListingsView.title, `%${search}%`),
          ilike(marketListingsView.username, `%${s}%`)
        )
      );
    }

    if (kind) conds.push(eq(marketListingsView.kind, kind));
    if (platform) conds.push(eq(marketListingsView.platform, platform));
    if (onlyActive) conds.push(eq(marketListingsView.isActive, true));

    // فلترة البائع
    if (seller && seller.trim() !== "") {
      const s = seller.trim().replace(/^@/, "").toLowerCase();
      conds.push(ilike(marketListingsView.seller, `%${s}%`));
    }

    // 📦 جلب الإعلانات
    const rows = await db
      .select()
      .from(marketListingsView)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(marketListingsView.createdAt));

    if (!rows.length) return res.json([]);

    // 📦 جلب بيانات البائعين (id + username + telegramId)
    const sellerIds = Array.from(new Set(rows.map((r) => r.sellerId).filter(Boolean) as string[]));
    let sellers: { id: string; username: string | null; telegramId: string | null }[] = [];

    if (sellerIds.length) {
      sellers = await db
        .select({ id: users.id, username: users.username, telegramId: users.telegramId })
        .from(users)
        .where(inArray(users.id, sellerIds));
    }

    const sellersMap = new Map(
      sellers.map((u) => [u.id, { id: u.id, username: u.username, telegramId: u.telegramId }])
    );

    // 🟢 تجهيز الاستجابة النهائية
    const out = rows.map((r) => {
      const sellerData = r.sellerId ? sellersMap.get(r.sellerId) : null;
      return {
        ...r,
        seller: sellerData
          ? {
              id: sellerData.id,
              username: sellerData.username ?? null,
              telegramId: sellerData.telegramId ?? null,
            }
          : null,
      };
    });

    res.json(out);
  } catch (e: any) {
    console.error("listListings error:", e);
    res.status(500).json({ error: e?.message || "unknown_error" });
  }
}