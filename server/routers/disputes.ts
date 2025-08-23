// server/routers/disputes.ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, desc, or, and } from "drizzle-orm";
import { db } from "../db.js";
import { disputes, messages, listings, payments } from "@shared/schema";

/* =========================
   Schemas
========================= */
const idParam = z.object({ id: z.string().uuid() });

const createDisputeSchema = z.object({
  paymentId: z.string().uuid(),
  buyerUsername: z.string().optional(),
  sellerUsername: z.string().optional(),
  reason: z.string().optional(),
  evidence: z.string().optional(),
});

/* =========================
   Helpers
========================= */
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

function getReqUsername(req: Request): string | undefined {
  const hdr =
    (req.headers["x-telegram-username"] as string) ||
    (req.headers["x-user-username"] as string);
  if (hdr && typeof hdr === "string") return hdr;
  const tg = (req as any).telegramUser;
  if (tg?.username) return String(tg.username);
  if (typeof req.body?.senderUsername === "string") return req.body.senderUsername;
  return undefined;
}

/** يجلب عنوان الليستنك عبر paymentId -> payments.listingId -> listings.title */
async function fetchListingTitleByPaymentId(paymentId: string): Promise<string | null> {
  const p = await db
    .select({ listingId: payments.listingId })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  const listingId = p[0]?.listingId;
  if (!listingId) return null;

  const l = await db
    .select({ title: listings.title })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  return l[0]?.title ?? null;
}

/* =========================
   Routes
========================= */
export function registerDisputesRoutes(app: Express) {
  /** فهرس النزاعات:
   *  - بدون باراميتر: يرجع الكل بترتيب تنازلي
   *  - ?me=1 : يرجّع نزاعات تخص المستخدم الحالي (مشتري أو بائع)
   *  - ?username=: يرجّع نزاعات تخص هذا اليوزر
   */
  app.get("/api/disputes", async (req: Request, res: Response) => {
    try {
      const me = req.query.me === "1" || req.query.me === "true";
      const qUsername =
        typeof req.query.username === "string" && req.query.username.trim()
          ? String(req.query.username).trim()
          : undefined;

      const inferred = getReqUsername(req);
      const username = qUsername ?? (me ? inferred : undefined);

      if (!username) {
        const list = await db.select().from(disputes).orderBy(desc(disputes.createdAt));
        return res.json(list.map(expandDisputeRow));
      }

      const list = await db
        .select()
        .from(disputes)
        .where(or(eq(disputes.buyerUsername, username), eq(disputes.sellerUsername, username)))
        .orderBy(desc(disputes.createdAt));

      return res.json(list.map(expandDisputeRow));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** إنشاء نزاع:
   *  - يتحقق من وجود الـ payment
   *  - يملأ buyerUsername/sellerUsername من جدول payments إذا ما انبعثت
   */
  app.post("/api/disputes", async (req: Request, res: Response) => {
    try {
      const body = createDisputeSchema.parse(req.body ?? {});

      const payRow = await db
        .select({
          id: payments.id,
          buyerUsername: payments.buyerUsername,
          sellerUsername: payments.sellerUsername,
          listingId: payments.listingId,
        })
        .from(payments)
        .where(eq(payments.id, body.paymentId))
        .limit(1);

      if (!payRow.length) return res.status(404).json({ error: "payment_not_found" });

      const buyerU = body.buyerUsername ?? payRow[0].buyerUsername ?? null;
      const sellerU = body.sellerUsername ?? payRow[0].sellerUsername ?? null;

      const inserted = await db
        .insert(disputes)
        .values({
          paymentId: body.paymentId,
          buyerUsername: buyerU,
          sellerUsername: sellerU,
          reason: body.reason ?? null,
          evidence: body.evidence ?? null,
          status: "open",
        })
        .returning();

      const listingTitle = await fetchListingTitleByPaymentId(body.paymentId);

      return res.status(201).json(expandDisputeRow({ ...inserted[0], listingTitle }));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** قراءة نزاع مفرد + listingTitle من payment->listing */
  app.get("/api/disputes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);

      const rows = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!rows.length) return res.status(404).json({ error: "not_found" });

      const d = rows[0];
      const listingTitle = d.paymentId ? await fetchListingTitleByPaymentId(d.paymentId) : null;

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

  /** رسائل النزاع - إنشاء: يقبل { text } ويستنتج senderUsername بأمان */
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

  /** حسم النزاع: status=resolved + resolvedAt */
  app.post("/api/disputes/:id/resolve", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const updated = await db
        .update(disputes)
        .set({ status: "resolved", resolvedAt: new Date() })
        .where(eq(disputes.id, id))
        .returning();
      if (!updated.length) return res.status(404).json({ error: "not_found" });

      const d = updated[0];
      const listingTitle = d.paymentId ? await fetchListingTitleByPaymentId(d.paymentId) : null;

      return res.json(expandDisputeRow({ ...d, listingTitle }));
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

      const d = updated[0];
      const listingTitle = d.paymentId ? await fetchListingTitleByPaymentId(d.paymentId) : null;

      return res.json(expandDisputeRow({ ...d, listingTitle }));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });
}