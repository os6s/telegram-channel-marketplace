// server/routers/disputes.ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, desc, or } from "drizzle-orm";
import { db } from "../db.js";
import { disputes, messages, listings, payments } from "@shared/schema";
import { tgOptionalAuth } from "../middleware/tgAuth.js";

/* ========================= Schemas ========================= */
const idParam = z.object({ id: z.string().uuid() });
const createDisputeSchema = z.object({
  paymentId: z.string().uuid(),
  buyerUsername: z.string().optional(),
  sellerUsername: z.string().optional(),
  reason: z.string().optional(),
  evidence: z.string().optional(),
});

/* ========================= Helpers ========================= */
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
  if (hdr && typeof hdr === "string") return hdr.toLowerCase();
  const tg = (req as any).telegramUser;
  if (tg?.username) return String(tg.username).toLowerCase();
  if (typeof req.body?.senderUsername === "string") return String(req.body.senderUsername).toLowerCase();
  return undefined;
}

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

/** السماح فقط للمشتري/البائع بالدخول */
function ensureParticipant(req: Request, d: { buyerUsername: string|null; sellerUsername: string|null }) {
  const me = getReqUsername(req) || "";
  const by = (d.buyerUsername || "").toLowerCase();
  const se = (d.sellerUsername || "").toLowerCase();
  return !!me && (me === by || me === se);
}

/* ========================= Routes ========================= */
export function registerDisputesRoutes(app: Express) {
  // فعّل التوثيق الاختياري لكل طلبات النزاعات
  app.use("/api/disputes", tgOptionalAuth);

  /** فهرس نزاعات المستخدم */
  app.get("/api/disputes", async (req: Request, res: Response) => {
    try {
      const me = req.query.me === "1" || req.query.me === "true";
      const inferred = getReqUsername(req);
      if (!me || !inferred) {
        return res.status(403).json({ error: "forbidden" });
      }

      const list = await db
        .select()
        .from(disputes)
        .where(or(eq(disputes.buyerUsername, inferred), eq(disputes.sellerUsername, inferred)))
        .orderBy(desc(disputes.createdAt));

      return res.json(list.map(expandDisputeRow));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** إنشاء نزاع */
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

  /** قراءة نزاع مفرد */
  app.get("/api/disputes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const rows = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!rows.length) return res.status(404).json({ error: "not_found" });
      const d = rows[0];
      if (!ensureParticipant(req, d)) return res.status(403).json({ error: "forbidden" });

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
      const dRows = await db.select({
        buyerUsername: disputes.buyerUsername,
        sellerUsername: disputes.sellerUsername,
      }).from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!dRows.length) return res.status(404).json({ error: "dispute_not_found" });
      if (!ensureParticipant(req, dRows[0])) return res.status(403).json({ error: "forbidden" });

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

  /** رسائل النزاع - إنشاء */
  app.post("/api/disputes/:id/messages", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const text = z.string().min(1).parse(req.body?.text);
      const me = getReqUsername(req);
      if (!me) return res.status(401).json({ error: "unauthorized" });

      const dRows = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!dRows.length) return res.status(404).json({ error: "dispute_not_found" });
      if (!ensureParticipant(req, dRows[0])) return res.status(403).json({ error: "forbidden" });

      const row = await db
        .insert(messages)
        .values({ disputeId: id, content: text, senderUsername: me })
        .returning();

      return res.status(201).json(row[0]);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** حسم النزاع */
  app.post("/api/disputes/:id/resolve", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const dRows = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!dRows.length) return res.status(404).json({ error: "not_found" });
      if (!ensureParticipant(req, dRows[0])) return res.status(403).json({ error: "forbidden" });

      const updated = await db
        .update(disputes)
        .set({ status: "resolved", resolvedAt: new Date() })
        .where(eq(disputes.id, id))
        .returning();

      const d = updated[0];
      const listingTitle = d.paymentId ? await fetchListingTitleByPaymentId(d.paymentId) : null;
      return res.json(expandDisputeRow({ ...d, listingTitle }));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** إلغاء/إغلاق النزاع */
  app.post("/api/disputes/:id/cancel", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const dRows = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!dRows.length) return res.status(404).json({ error: "not_found" });
      if (!ensureParticipant(req, dRows[0])) return res.status(403).json({ error: "forbidden" });

      const updated = await db
        .update(disputes)
        .set({ status: "cancelled" })
        .where(eq(disputes.id, id))
        .returning();

      const d = updated[0];
      const listingTitle = d.paymentId ? await fetchListingTitleByPaymentId(d.paymentId) : null;
      return res.json(expandDisputeRow({ ...d, listingTitle }));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });
}

// للتوافق مع استيراد mountDisputes
export { registerDisputesRoutes as mountDisputes };