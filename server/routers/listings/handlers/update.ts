// server/routers/listings/handlers/update.ts
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../db.js";
import { listings } from "@shared/schema";

const updateListingSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  price: z.string().regex(/^[0-9]+(\.[0-9]+)?$/).optional(),
  isActive: z.boolean().optional(),
});

export async function updateListing(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id_required" });

    const parsed = updateListingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_payload", details: parsed.error.flatten() });
    }

    const updates: Partial<typeof listings.$inferInsert> = {
      ...parsed.data,
      updatedAt: new Date(),
    };

    const [row] = await db
      .update(listings)
      .set(updates)
      .where(eq(listings.id, id))
      .returning();

    if (!row) return res.status(404).json({ error: "listing_not_found" });

    res.json(row);
  } catch (error: any) {
    console.error("updateListing error:", error);
    res
      .status(500)
      .json({ error: error?.message || "unknown_error" });
  }
}