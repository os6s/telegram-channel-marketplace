// server/routers/disputes.ts
import type { Express } from "express";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  disputes,
  insertDisputeSchema,
  type Dispute,
} from "@shared/schema";

/* ------------ Schemas ------------ */
const createDisputeBody = insertDisputeSchema.pick({
  paymentId: true,
  buyerId: true,
  sellerId: true,
  reason: true,
});

const listQuery = z.object({
  userId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
  status: z.enum(["open", "reviewing", "resolved", "cancelled"]).optional(),
});

const updateDisputeBody = z.object({
  actorId: z.string().uuid(),
  status: z.enum(["open", "reviewing", "resolved", "cancelled"]).optional(),
  reason: z.string().optional(),
  resolvedAt: z.string().datetime().optional(),
});

/* ------------ Helpers ------------ */
function isAdmin(u: any | undefined) {
  if (!u) return false;
  return u.role === "admin" || (u.username ?? "").toLowerCase() === "os6s7";
}

/* ------------ Routes ------------ */
export function mountDisputes(app: Express) {
  // إنشاء نزاع
  app.post("/api/disputes", async (req, res) => {
    try {
      const body = createDisputeBody.parse(req.body);
      const row = await db
        .insert(disputes)
        .values({
          paymentId: body.paymentId,
          buyerId: body.buyerId,
          sellerId: body.sellerId,
          reason: body.reason ?? null,
          status: "open",
        })
        .returning();
      res.status(201).json(row[0]);
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Invalid payload" });
    }
  });

  // استعلام النزاعات
  app.get("/api/disputes", async (req, res) => {
    try {
      const q = listQuery.parse(req.query);
      const conds: any[] = [];
      if (q.userId) conds.push(or(eq(disputes.buyerId, q.userId), eq(disputes.sellerId, q.userId)));
      if (q.paymentId) conds.push(eq(disputes.paymentId, q.paymentId));
      if (q.status) conds.push(eq(disputes.status, q.status));

      const where = conds.length ? (conds.length > 1 ? and(...conds) : conds[0]) : undefined;

      const rows = await db
        .select()
        .from(disputes)
        .where(where as any)
        .orderBy(desc(disputes.createdAt));
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

  // تحديث نزاع — فقط الإدمن
  app.patch("/api/disputes/:id", async (req, res) => {
    try {
      const body = updateDisputeBody.parse(req.body);

      // ملاحظة: التحقق من صلاحيات الإدمن يتطلب جلب المستخدم من DB عندك
      const actor = await (await import("../storage")).storage.getUser(body.actorId);
      if (!isAdmin(actor)) return res.status(403).json({ error: "Forbidden" });

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