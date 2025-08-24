import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../../db.js";
import { activitiesView } from "@shared/schema";

export async function getActivity(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "id required" });

    const rows = await db.select().from(activitiesView).where(eq(activitiesView.id, id));
    if (!rows.length) return res.status(404).json({ error: "Activity not found" });
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Unknown error" });
  }
}
