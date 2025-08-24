import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../../db.js";
import { activities } from "@shared/schema";

export async function updateActivity(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    const allowed: Partial<typeof activities.$inferInsert> = {};
    if (typeof req.body?.status === "string") allowed.status = req.body.status as any;
    if (req.body?.note !== undefined) allowed.note = req.body.note;

    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ error: "no_updates" });
    }

    const updated = await db.update(activities).set(allowed).where(eq(activities.id, id)).returning();
    if (!updated.length) return res.status(404).json({ error: "Activity not found" });
    res.json(updated[0]);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Unknown error" });
  }
}
