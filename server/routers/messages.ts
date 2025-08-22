// server/routers/messages.ts
import type { Express } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { messages, disputes, users } from "@shared/schema";

const createMessageBody = z.object({
  content: z.string().min(1),
  senderId: z.string().uuid(),
});

function isAdmin(u: any | undefined) {
  return !!u && (u.role === "admin" || (u.username ?? "").toLowerCase() === "os6s7");
}

export function mountDisputeMessages(app: Express) {
  // إنشاء رسالة ضمن نزاع
  app.post("/api/disputes/:id/messages", async (req, res) => {
    try {
      const body = createMessageBody.parse(req.body);
      const disputeId = req.params.id;

      // تأكد أن النزاع موجود
      const [d] = await db.select().from(disputes).where(eq(disputes.id, disputeId)).limit(1);
      if (!d) return res.status(404).json({ error: "Dispute not found" });

      // تحقق المرسل موجود ومسموح له
      const [u] = await db.select().from(users).where(eq(users.id, body.senderId)).limit(1);
      if (!u) return res.status(403).json({ error: "Invalid sender" });

      const isParty = body.senderId === d.buyerId || body.senderId === d.sellerId;
      if (!isParty && !isAdmin(u)) return res.status(403).json({ error: "Forbidden" });

      const row = await db
        .insert(messages)
        .values({ disputeId, senderId: body.senderId, content: body.content })
        .returning();

      res.status(201).json(row[0]);
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Invalid payload" });
    }
  });

  // جلب رسائل النزاع
  app.get("/api/disputes/:id/messages", async (req, res) => {
    try {
      const disputeId = req.params.id;
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.disputeId, disputeId))
        .orderBy(asc(messages.createdAt));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Unknown error" });
    }
  });

  // حذف رسالة — أدمن فقط
  app.delete("/api/disputes/:id/messages/:msgId", async (req, res) => {
    try {
      const actorId = String(req.query.actorId || "");
      if (!actorId) return res.status(400).json({ error: "actorId required" });

      const [actor] = await db.select().from(users).where(eq(users.id, actorId)).limit(1);
      if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Forbidden" });

      const { id: disputeId, msgId } = req.params;

      const del = await db
        .delete(messages)
        .where(and(eq(messages.id, msgId), eq(messages.disputeId, disputeId)))
        .returning();
      if (!del[0]) return res.status(404).json({ error: "Message not found" });

      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "Invalid request" });
    }
  });
}