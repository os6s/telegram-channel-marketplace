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
    if (seller && seller.trim() !== "") {
      const s = seller.trim().replace(/^@/, "").toLowerCase();
      conds.push(ilike(marketListingsView.seller, `%${s}%`));
    }

    // listings
    const rows = await db
      .select()
      .from(marketListingsView)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(marketListingsView.createdAt));

    if (!rows.length) return res.json([]);

    // ✅ هنانا نجيب sellers details
    const sellerIds = Array.from(new Set(rows.map((r) => r.sellerId).filter(Boolean) as string[]));
    let sellers: any[] = [];
    if (sellerIds.length) {
      sellers = await db
        .select({
          id: users.id,
          username: users.username,
          name: users.name,
        })
        .from(users)
        .where(inArray(users.id, sellerIds));
    }
    const sellersMap = new Map(sellers.map((u) => [u.id, u]));

    // ✅ نبني الريسبونس بنفس الـ shape
    const out = rows.map((r) => ({
      ...r,
      seller: r.sellerId
        ? {
            id: r.sellerId,
            username: sellersMap.get(r.sellerId)?.username ?? null,
            name: sellersMap.get(r.sellerId)?.name ?? null,
          }
        : null,
    }));

    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "unknown_error" });
  }
}