// server/routers/disputes.ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../db.js";
import { disputes, messages, listings } from "@shared/schema";

const idParam = z.object({ id: z.string().uuid() });

const createDisputeSchema = z.object({
  paymentId: z.string().uuid(),
  buyerUsername: z.string().optional(),
  sellerUsername: z.string().optional(),
  reason: z.string().optional(),
  evidence: z.string().optional(),
});

/** يرجّع الشكل المناسب للفرونت */
function expandDisputeRow(row: any) {
  return {
    ...row,
    buyer: row?.buyerUsername ? { username: row.buyerUsername } : null,
    seller: row?.sellerUsername ? { username: row.sellerUsername } : null,
    orderId: row?.paymentId ?? null,
    listingTitle: row?.listingTitle ?? null,
    lastUpdateAt: row?.resolvedAt ?? row?.createdAt,
  };
}

/** يستخرج يوزر من الهيدر أو ميدلوير tgAuth */
function getReqUsername(req: Request): string | undefined {
  const hdr =
    (req.headers["x-telegram-username"] as string) ||
    (req.headers["x-user-username"] as string);
  if (hdr && typeof hdr === "string") return hdr;
  const tg = (req as any).telegramUser;
  if (tg?.username) return tg.username as string;
  if (typeof req.body?.senderUsername === "string") return req.body.senderUsername;
  return undefined;
}

export function registerDisputesRoutes(app: Express) {
  /** إنشاء نزاع */
  app.post("/api/disputes", async (req: Request, res: Response) => {
    try {
      const body = createDisputeSchema.parse(req.body ?? {});
      const inserted = await db
        .insert(disputes)
        .values({
          paymentId: body.paymentId,
          buyerUsername: body.buyerUsername ?? null,
          sellerUsername: body.sellerUsername ?? null,
          reason: body.reason ?? null,
          evidence: body.evidence ?? null,
          status: "open",
        })
        .returning();
      return res.status(201).json(expandDisputeRow(inserted[0]));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** قراءة نزاع + عنوان الليستنك إن توفّر */
  app.get("/api/disputes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const rows = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!rows.length) return res.status(404).json({ error: "not_found" });

      const d = rows[0];
      // محاولة جلب listingTitle إذا عندك ربط بين payment->listing أو تخزّنه بغير مكان
      // هنا نفترض عندك listingId داخل disputes غير موجود حالياً، فالعنوان يبقى null
      const listingTitle: string | null = null;

      return res.json(expandDisputeRow({ ...d, listingTitle }));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** رسائل النزاع - قراءة */
  app.get("/api/disputes/:id/messages", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const list = await db
        .select()
        .from(messages)
        .where(eq(messages.disputeId, id))
        .orderBy(desc(messages.createdAt));
      return res.json(list);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** رسائل النزاع - إنشاء: يقبل { text } */
  app.post("/api/disputes/:id/messages", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const text = z.string().min(1).parse(req.body?.text);
      const senderUsername = getReqUsername(req);
      if (!senderUsername) return res.status(401).json({ error: "unauthorized" });

      const exists = await db
        .select({ id: disputes.id })
        .from(disputes)
        .where(eq(disputes.id, id))
        .limit(1);
      if (!exists.length) return res.status(404).json({ error: "dispute_not_found" });

      const row = await db
        .insert(messages)
        .values({ disputeId: id, content: text, senderUsername })
        .returning();

      return res.status(201).json(row[0]);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** حسم النزاع: يضبط status=resolved و resolvedAt */
  app.post("/api/disputes/:id/resolve", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const updated = await db
        .update(disputes)
        .set({ status: "resolved", resolvedAt: new Date() })
        .where(eq(disputes.id, id))
        .returning();
      if (!updated.length) return res.status(404).json({ error: "not_found" });
      return res.json(expandDisputeRow(updated[0]));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** إلغاء/إغلاق النزاع: status=cancelled */
  app.post("/api/disputes/:id/cancel", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const updated = await db
        .update(disputes)
        .set({ status: "cancelled" })
        .where(eq(disputes.id, id))
        .returning();
      if (!updated.length) return res.status(404).json({ error: "not_found" });
      return res.json(expandDisputeRow(updated[0]));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });
}