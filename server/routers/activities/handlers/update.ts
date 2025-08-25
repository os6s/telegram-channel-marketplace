import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../db.js";
import { activities } from "@shared/schema";

const updateSchema = z.object({
  status: z.enum(["pending","completed","failed","cancelled"]).optional(),
  note: z.union([z.string(), z.record(z.any())]).optional(),
});

export async function updateActivity(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    }

    const allowed: Partial<typeof activities.$inferInsert> = {};
    if (parsed.data.status) allowed.status = parsed.data.status as any;
    if (parsed.data.note !== undefined) allowed.note = parsed.data.note;
    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ error: "no_updates" });
    }

    // optional: add updatedAt
    (allowed as any).updatedAt = new Date();

    const updated = await db
      .update(activities)
      .set(allowed)
      .where(eq(activities.id, id))
      .returning();

    if (!updated.length) {
      return res.status(404).json({ error: "Activity not found" });
    }

    res.json(updated[0]);
  } catch (error: any) {
    console.error("updateActivity error:", error);
    res.status(500).json({ error: error?.message || "Unknown error" });
  }
}