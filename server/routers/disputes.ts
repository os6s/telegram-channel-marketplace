import type { Express } from "express";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  disputes,
  users,
  insertDisputeSchema,
  type Dispute,
} from "@shared/schema";

const createDisputeBody = insertDisputeSchema.pick({
  paymentId: true,
  buyerId: true,
  sellerId: true,
  reason: true,
});

const listQuery = z.object({
  userId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
  status: z.enum(["open","closed"]).optional(),
});

const updateDisputeBody = z.object({
  actorId: z.string().uuid(),                       // من ينفّذ العملية
  status: z.enum(["open","closed"]).optional(),
  reason: z.string().optional(),                    // تعديل السبب (اختياري)
  resolvedAt: z.string().datetime().optional(),     // يُرسل من الفرونت عند الإغلاق
});

export function mountDisputes(app: Express) {
  // إنشاء نزاع
  app.post("/api/disputes", async (req, res) => {
    try {
      const body = createDisputeBody.parse(req.body);
      const row = await db.insert(disputes).values({
        paymentId: body.paymentId,
        buyerId: body.buyerId,
        sellerId: body.sellerId,
        reason: body.reason ?? null,
        status: "open",
      }).returning();
      res.status(201).json(row[0]);
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Invalid payload" });
    }
  });

  // استعلام النزاعات (حسب userId أو paymentId)
  app.get("/api/disputes", async (req, res) => {
    try {
      const q = listQuery.parse(req.query);
      const conds: any[] = [];
      if (q.userId) conds.push(or(eq(disputes.buyerId, q.userId), eq(disputes.sellerId, q.userId)));
      if (q.paymentId) conds.push(eq(disputes.paymentId, q.paymentId));
      if (q.status) conds.push(eq(disputes.status, q.status));

      const where = conds.length ? (conds.length > 1 ? and(...conds) : conds[0]) : undefined;
      const rows = await db.select().from(disputes).where(where as any).orderBy(desc(disputes.createdAt));
      res.json(rows as Dispute[]);
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Invalid query" });
    }
  });

  // نزاع واحد
  app.get("/api/disputes/:id", async (req, res) => {
    try {
      const [row] = await db.select().from(disputes).where(eq(disputes.id, req.params.id)).limit(1);
      if (!row) return res.status(404).json({ error: "Dispute not found" });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  // تحديث نزاع (إغلاق/فتح) — فقط الأدمن
  app.patch("/api/disputes/:id", async (req, res) => {
    try {
      const body = updateDisputeBody.parse(req.body);
      const [actor] = await db.select().from(users).where(eq(users.id, body.actorId)).limit(1);
      if (!actor) return res.status(403).json({ error: "Invalid actor" });

      // سماح إذا role=admin أو username=Os6s7
      const isAdmin = actor.role === "admin" || (actor.username ?? "").toLowerCase() === "os6s7";
      if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

      const updates: any = {};
      if (body.status) updates.status = body.status;
      if (body.reason !== undefined) updates.reason = body.reason;
      if (body.resolvedAt) updates.resolvedAt = new Date(body.resolvedAt) as any;

      const row = await db.update(disputes).set(updates).where(eq(disputes.id, req.params.id)).returning();
      if (!row[0]) return res.status(404).json({ error: "Dispute not found" });
      res.json(row[0]);
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Invalid payload" });
    }
  });
}