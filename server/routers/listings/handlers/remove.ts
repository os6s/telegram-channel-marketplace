import type { Request, Response } from "express";
import { db } from "../../../db.js";
import { eq } from "drizzle-orm";
import { listings, users } from "@shared/schema";

async function me(req: Request) {
  const tg = req.telegramUser;
  if (!tg?.id) return null;
  return db.query.users.findFirst({
    where: eq(users.telegramId, Number(tg.id)),
  });
}

export async function removeListing(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    const user = await me(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const listing = await db.query.listings.findFirst({
      where: eq(listings.id, id),
    });
    if (!listing) return res.status(404).json({ error: "not_found" });

    const amOwner = listing.sellerId === user.id;
    const amAdmin =
      (user.role || "").toLowerCase() === "admin" ||
      (user.role || "").toLowerCase() === "moderator";

    if (!amOwner && !amAdmin) {
      return res.status(403).json({ error: "forbidden" });
    }

    await db.delete(listings).where(eq(listings.id, id));
    res.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error("removeListing error:", err);
    res.status(500).json({ error: err?.message || "internal_error" });
  }
}