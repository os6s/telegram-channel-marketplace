// server/routers/disputes.ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db.js"; // يفترض موجود بالمشروع
import {
  disputes,
  messages,
  payments,
  listings,
  // لو ما متاحة ببُكج @shared/schema عدّل المسار حسب مشروعك:
} from "@shared/schema";

const createDisputeSchema = z.object({
  paymentId: z.string().uuid().optional(),
  listingId: z.string().uuid().optional(),
  buyerUsername: z.string().min(1),
  sellerUsername: z.string().min(1),
  reason: z.string().min(1).optional(),
});

const idParam = z.object({ id: z.string().uuid() });

/** تطبيع إخراج النزاع كما تتوقعه صفحة الفرونت */
function expandDisputeRow(row: any) {
  return {
    ...row,
    buyer: row?.buyerUsername ? { username: row.buyerUsername } : null,
    seller: row?.sellerUsername ? { username: row.sellerUsername } : null,
    orderId: row?.paymentId ?? null,
    listingTitle: row?.listingTitle ?? null,
    lastUpdateAt: row?.resolvedAt ?? row?.updatedAt ?? row?.createdAt,
  };
}

/** استنتاج اسم المستخدم من الهيدر/الكونتكست إذا متاح */
function getReqUsername(req: Request): string | undefined {
  // جرّب مصادر متعددة بدون كسر المشروع
  // 1) هيدر مخصص إذا موجود
  const fromHeader =
    (req.headers["x-telegram-username"] as string) ||
    (req.headers["x-user-username"] as string);
  if (fromHeader && typeof fromHeader === "string") return fromHeader;

  // 2) ميدلوير قد يضيف telegramUser
  const tgUser = (req as any).telegramUser;
  if (tgUser?.username) return tgUser.username as string;

  // 3) بادي صريح
  if (typeof (req.body?.senderUsername) === "string") return req.body.senderUsername;

  return undefined;
}

export function registerDisputesRoutes(app: Express) {
  /** إنشاء نزاع */
  app.post("/api/disputes", async (req: Request, res: Response) => {
    try {
      const body = createDisputeSchema.parse(req.body ?? {});
      const row = await db
        .insert(disputes)
        .values({
          paymentId: body.paymentId ?? null,
          listingId: body.listingId ?? null,
          buyerUsername: body.buyerUsername,
          sellerUsername: body.sellerUsername,
          reason: body.reason ?? null,
          status: "open",
        })
        .returning();
      return res.json(expandDisputeRow(row[0]));
    } catch (err: any) {
      return res.status(400).json({ error: err?.message ?? "invalid_request" });
    }
  });

  /** قراءة نزاع مفرد + ضم عناوين مفيدة (listingTitle) إن توفرت */
  app.get("/api/disputes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);

      // اجلب النزاع
      const rows = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (rows.length === 0) return res.status(404).json({ error: "not_found" });
      const d = rows[0];

      // listingTitle اختياري
      let listingTitle: string | null = null;
      if (d.listingId) {
        const l = await db.select({ title: listings.title }).from(listings).where(eq(listings.id, d.listingId)).limit(1);
        if (l.length) listingTitle = l[0].title ?? null;
      }

      const expanded = expandDisputeRow({ ...d, listingTitle });
      return res.json(expanded);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message ?? "invalid_request" });
    }
  });

  /** قائمة رسائل النزاع */
  app.get("/api/disputes/:id/messages", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const list = await db
        .select()
        .from(messages)
        .where(eq(messages.disputeId, id))
        .orderBy(desc(messages.createdAt));
      return res.json(list);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message ?? "invalid_request" });
    }
  });

  /** إنشاء رسالة نزاع: يقبل { text } كما يتوقع الفرونت */
  app.post("/api/disputes/:id/messages", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const text = z.string().min(1).parse(req.body?.text);
      const senderUsername = getReqUsername(req);
      if (!senderUsername) return res.status(401).json({ error: "unauthorized" });

      // تأكد النزاع موجود
      const exists = await db.select({ id: disputes.id }).from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!exists.length) return res.status(404).json({ error: "dispute_not_found" });

      const row = await db
        .insert(messages)
        .values({
          disputeId: id,
          content: text,
          senderUsername,
        })
        .returning();

      return res.status(201).json(row[0]);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message ?? "invalid_request" });
    }
  });

  /** حسم النزاع */
  app.post("/api/disputes/:id/resolve", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);

      // خيار إضافي: منو الفائز؟ buyer/seller؟ إن احتجته لاحقًا
      const resolutionNote = typeof req.body?.note === "string" ? req.body.note : null;

      const row = await db
        .update(disputes)
        .set({ status: "resolved", resolvedAt: new Date(), resolutionNote })
        .where(eq(disputes.id, id))
        .returning();

      if (!row.length) return res.status(404).json({ error: "not_found" });
      return res.json(expandDisputeRow(row[0]));
    } catch (err: any) {
      return res.status(400).json({ error: err?.message ?? "invalid_request" });
    }
  });

  /** إلغاء/إغلاق النزاع */
  app.post("/api/disputes/:id/cancel", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const row = await db
        .update(disputes)
        .set({ status: "cancelled" })
        .where(eq(disputes.id, id))
        .returning();
      if (!row.length) return res.status(404).json({ error: "not_found" });
      return res.json(expandDisputeRow(row[0]));
    } catch (err: any) {
      return res.status(400).json({ error: err?.message ?? "invalid_request" });
    }
  });
}