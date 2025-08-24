import type { Request, Response } from "express";
import { z } from "zod";
import { and, desc, ilike, or, eq } from "drizzle-orm";
import { db } from "../../../db.js";
import { activitiesView } from "@shared/schema";

const listQuery = z.object({
  username: z.string().min(1).optional(),
  listingId: z.string().uuid().optional(),
});

export async function listActivities(req: Request, res: Response) {
  try {
    const q = listQuery.safeParse(req.query);
    if (!q.success || (!q.data.username && !q.data.listingId)) {
      return res.status(400).json({ error: "username or listingId required" });
    }

    const conds: any[] = [];
    if (q.data.username) {
      const u = q.data.username.replace(/^@/, "").toLowerCase();
      conds.push(
        or(
          ilike(activitiesView.buyerUsername, `%${u}%`),
          ilike(activitiesView.sellerUsername, `%${u}%`)
        )
      );
    }
    if (q.data.listingId) conds.push(eq(activitiesView.listingId, q.data.listingId));

    const rows = await db
      .select()
      .from(activitiesView)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(activitiesView.createdAt));

    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Unknown error" });
  }
}
