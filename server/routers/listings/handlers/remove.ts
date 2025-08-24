import type { Request, Response } from "express";
import { db } from "../../../db.js";
import { eq } from "drizzle-orm";
import { listings, users } from "@shared/schema";

async function me(req: Request) {
  return (await db.query.users.findFirst({
    where: users.telegramId.eq(Number(req.telegramUser!.id)),
  }))!;
}

export async function removeListing(req: Request, res: Response) {
  const id = String(req.params.id || "");
  if (!id) return res.status(400).json({ error: "id required" });

  const user = await me(req);
  const listing = await db.query.listings.findFirst({ where: eq(listings.id, id) });
  if (!listing) return res.status(404).json({ error: "not_found" });

  const amOwner = listing.sellerId === user.id;
  const amAdmin = user.role === "admin" || user.role === "moderator";
  if (!amOwner && !amAdmin) return res.status(403).json({ error: "forbidden" });

  await db.delete(listings).where(eq(listings.id, id));
  res.json({ success: true, deletedId: id });
}