import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../../db.js";
import { activitiesView } from "@shared/schema";

export async function getActivity(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      console.warn("getActivity: missing id param");
      return res.status(400).json({ error: "id required" });
    }

    // optional: UUID check
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      console.warn("getActivity: invalid id format", id);
      return res.status(400).json({ error: "invalid id format" });
    }

    const rows = await db
      .select()
      .from(activitiesView)
      .where(eq(activitiesView.id, id))
      .limit(1);

    if (!rows.length) {
      console.warn("getActivity: not found", id);
      return res.status(404).json({ error: "Activity not found" });
    }

    res.json(rows[0]);
  } catch (error: any) {
    console.error("getActivity error:", error);
    res.status(500).json({ error: error?.message || "Unknown error" });
  }
}