// server/routers/disputes.ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, desc, or } from "drizzle-orm";
import { db } from "../db.js";
import { disputes, messages, listings, payments, users } from "@shared/schema";
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

function ensureParticipant(req: Request, d: { buyerUsername: string|null; sellerUsername: string|null }) {
  const me = getReqUsername(req) || "";
  const by = (d.buyerUsername || "").toLowerCase();
  const se = (d.sellerUsername || "").toLowerCase();
  return !!me && (me === by || me === se);
}

async function getCurrentUser(req: Request) {
  const tg = (req as any).telegramUser;
  if (!tg?.id) return null;
  const row = await db.query.users.findFirst({ where: eq(users.telegramId, BigInt(tg.id)) });
  return row || null;
}
const isAdminUser = (u: any | null) => !!u && (u.role === "admin" || u.role === "moderator");
async function canAccess(req: Request, d: { buyerUsername: string|null; sellerUsername: string|null }) {
  const me = await getCurrentUser(req);
  if (isAdminUser(me)) return true;
  return ensureParticipant(req, d);
}

/* ========================= Routes ========================= */
export function registerDisputesRoutes(app: Express) {
  // تفعيل التوثيق الاختياري لكل طلبات النزاعات (يملأ req.telegramUser إذا موجود initData)
  app.use("/api/disputes", tgOptionalAuth);

  /** فهرس النزاعات
   *  - إذا المستخدم أدمن/مودريتر → يرجع كل النزاعات (مع ترتيب أحدث أولاً)
   *  - غير ذلك: يحتاج ?me=1 ويُرجع نزاعات المستخدم الحالي فقط (حسب username)
   */
  app.get("/api/disputes", async (req: Request, res: Response) => {
    try {
      const me = await getCurrentUser(req);
      const amAdmin = isAdminUser(me);

      if (amAdmin) {
        const list = await db.select().from(disputes).orderBy(desc(disputes.createdAt));
        return res.json(list.map(expandDisputeRow));
      }

      const onlyMe = req.query.me === "1" || req.query.me === "true";
      const inferred = getReqUsername(req);
      if (!onlyMe || !inferred) {
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

  /** إنشاء نزاع (أي طرف يقدر ينشئ؛ الأدمن أيضاً) */
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

      const buyerU = (body.buyerUsername ?? payRow[0].buyerUsername ?? null)?.toLowerCase() ?? null;
      const sellerU = (body.sellerUsername ?? payRow[0].sellerUsername ?? null)?.toLowerCase() ?? null;

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

  /** قراءة نزاع مفرد (المشاركون أو الأدمن) */
  app.get("/api/disputes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const rows = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!rows.length) return res.status(404).json({ error: "not_found" });
      const d = rows[0];

      if (!(await canAccess(req, d))) return res.status(403).json({ error: "forbidden" });

      const listingTitle = d.paymentId ? await fetchListingTitleByPaymentId(d.paymentId) : null;
      return res.json(expandDisputeRow({ ...d, listingTitle }));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** رسائل النزاع - قراءة (المشاركون أو الأدمن) */
  app.get("/api/disputes/:id/messages", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const dRows = await db
        .select({
          buyerUsername: disputes.buyerUsername,
          sellerUsername: disputes.sellerUsername,
        })
        .from(disputes)
        .where(eq(disputes.id, id))
        .limit(1);
      if (!dRows.length) return res.status(404).json({ error: "dispute_not_found" });

      // السماح للأدمن أيضاً
      const me = await getCurrentUser(req);
      const amAdmin = isAdminUser(me);
      if (!amAdmin && !ensureParticipant(req, dRows[0])) {
        return res.status(403).json({ error: "forbidden" });
      }

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

  /** رسائل النزاع - إنشاء (المشاركون أو الأدمن) */
  app.post("/api/disputes/:id/messages", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const text = z.string().min(1).parse(req.body?.text);

      const dRows = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!dRows.length) return res.status(404).json({ error: "dispute_not_found" });
      const d = dRows[0];

      const me = await getCurrentUser(req);
      const amAdmin = isAdminUser(me);
      const senderUsername =
        amAdmin
          ? (me?.username || "admin").toLowerCase()
          : (getReqUsername(req) || "");

      if (!amAdmin && !ensureParticipant(req, d)) {
        return res.status(403).json({ error: "forbidden" });
      }
      if (!senderUsername) return res.status(401).json({ error: "unauthorized" });

      const row = await db
        .insert(messages)
        .values({ disputeId: id, content: text, senderUsername })
        .returning();

      return res.status(201).json(row[0]);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** حسم النزاع (المشاركون أو الأدمن) */
  app.post("/api/disputes/:id/resolve", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);

      const dRows = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!dRows.length) return res.status(404).json({ error: "not_found" });
      const d = dRows[0];

      const me = await getCurrentUser(req);
      const amAdmin = isAdminUser(me);
      if (!amAdmin && !ensureParticipant(req, d)) {
        return res.status(403).json({ error: "forbidden" });
      }

      const updated = await db
        .update(disputes)
        .set({ status: "resolved", resolvedAt: new Date() })
        .where(eq(disputes.id, id))
        .returning();

      const d2 = updated[0];
      const listingTitle = d2.paymentId ? await fetchListingTitleByPaymentId(d2.paymentId) : null;
      return res.json(expandDisputeRow({ ...d2, listingTitle }));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** إلغاء/إغلاق النزاع (المشاركون أو الأدمن) */
  app.post("/api/disputes/:id/cancel", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);

      const dRows = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!dRows.length) return res.status(404).json({ error: "not_found" });
      const d = dRows[0];

      const me = await getCurrentUser(req);
      const amAdmin = isAdminUser(me);
      if (!amAdmin && !ensureParticipant(req, d)) {
        return res.status(403).json({ error: "forbidden" });
      }

      const updated = await db
        .update(disputes)
        .set({ status: "cancelled" })
        .where(eq(disputes.id, id))
        .returning();

      const d2 = updated[0];
      const listingTitle = d2.paymentId ? await fetchListingTitleByPaymentId(d2.paymentId) : null;
      return res.json(expandDisputeRow({ ...d2, listingTitle }));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });
}

// للتوافق مع استيراد mountDisputes
export { registerDisputesRoutes as mountDisputes };