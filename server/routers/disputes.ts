// server/routers/disputes.ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, desc, or } from "drizzle-orm";
import { db } from "../db.js";
import { tgOptionalAuth } from "../middleware/tgAuth.js";
import {
  disputes,
  messages,
  listings,
  payments,
  users,
} from "@shared/schema";

/* ========================= Schemas ========================= */
const idParam = z.object({ id: z.string().uuid() });
const createDisputeSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().optional(),
  evidence: z.string().optional(),
});

/* ========================= Helpers ========================= */
const S = (v: unknown) => (v == null ? "" : String(v));

async function getCurrentUser(req: Request) {
  const tg = (req as any).telegramUser as { id?: number; username?: string } | undefined;
  if (tg?.id) {
    const byTg = await db.query.users.findFirst({ where: eq(users.telegramId, Number(tg.id)) });
    if (byTg) return byTg;
  }
  const hdr =
    (req.headers["x-telegram-username"] as string) ||
    (req.headers["x-user-username"] as string) ||
    (tg?.username ? String(tg.username) : "");
  if (hdr) {
    const u = await db.query.users.findFirst({
      where: eq(users.username, hdr.toLowerCase()),
    });
    if (u) return u;
  }
  return null;
}
const isAdminUser = (u: any | null) => !!u && (u.role === "admin" || u.role === "moderator");

/** يوسّع صف النزاع بإرجاع يوزرنيمات الأطراف وعنوان اللستة */
function shapeDisputeRow(row: any) {
  return {
    id: row.id,
    paymentId: row.paymentId,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    buyer: row.buyerUsername ? { username: row.buyerUsername } : null,
    seller: row.sellerUsername ? { username: row.sellerUsername } : null,
    reason: row.reason ?? null,
    evidence: row.evidence ?? null,
    status: row.status,
    resolution: row.resolution ?? null,
    resolvedAt: row.resolvedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    listingTitle: row.listingTitle ?? null,
    lastUpdateAt: row.resolvedAt ?? row.createdAt,
  };
}

/* ========================= Routes ========================= */
export function mountDisputes(app: Express) {
  // يملأ req.telegramUser إن وجدت initData (بس مو إجباري)
  app.use("/api/disputes", tgOptionalAuth);

  /** GET /api/disputes
   * إذا أدمن → كل النزاعات
   * غير ذلك → يحتاج ?me=1 ويجيب فقط نزاعات المستخدم (بالـ IDs)
   */
  app.get("/api/disputes", async (req: Request, res: Response) => {
    try {
      const me = await getCurrentUser(req);
      const amAdmin = isAdminUser(me);

      if (amAdmin) {
        const buyerU = users.as("buyer_u");
        const sellerU = users.as("seller_u");
        const list = await db
          .select({
            id: disputes.id,
            paymentId: disputes.paymentId,
            buyerId: disputes.buyerId,
            sellerId: disputes.sellerId,
            reason: disputes.reason,
            evidence: disputes.evidence,
            status: disputes.status,
            resolution: disputes.resolution,
            resolvedAt: disputes.resolvedAt,
            createdAt: disputes.createdAt,
            updatedAt: disputes.updatedAt,
            buyerUsername: buyerU.username,
            sellerUsername: sellerU.username,
          })
          .from(disputes)
          .leftJoin(buyerU, eq(buyerU.id, disputes.buyerId))
          .leftJoin(sellerU, eq(sellerU.id, disputes.sellerId))
          .orderBy(desc(disputes.createdAt));

        return res.json(list.map(shapeDisputeRow));
      }

      const onlyMe = req.query.me === "1" || req.query.me === "true";
      if (!onlyMe || !me) return res.status(403).json({ error: "forbidden" });

      const buyerU = users.as("buyer_u");
      const sellerU = users.as("seller_u");

      const list = await db
        .select({
          id: disputes.id,
          paymentId: disputes.paymentId,
          buyerId: disputes.buyerId,
          sellerId: disputes.sellerId,
          reason: disputes.reason,
          evidence: disputes.evidence,
          status: disputes.status,
          resolution: disputes.resolution,
          resolvedAt: disputes.resolvedAt,
          createdAt: disputes.createdAt,
          updatedAt: disputes.updatedAt,
          buyerUsername: buyerU.username,
          sellerUsername: sellerU.username,
        })
        .from(disputes)
        .leftJoin(buyerU, eq(buyerU.id, disputes.buyerId))
        .leftJoin(sellerU, eq(sellerU.id, disputes.sellerId))
        .where(or(eq(disputes.buyerId, me.id), eq(disputes.sellerId, me.id)))
        .orderBy(desc(disputes.createdAt));

      return res.json(list.map(shapeDisputeRow));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** POST /api/disputes  — إنشاء نزاع من paymentId */
  app.post("/api/disputes", async (req: Request, res: Response) => {
    try {
      const body = createDisputeSchema.parse(req.body ?? {});

      // نجيب الـ payment مع IDs + عنوان اللستة (اختياري للرد)
      const buyerU = users.as("buyer_u");
      const sellerU = users.as("seller_u");
      const p = await db
        .select({
          id: payments.id,
          listingId: payments.listingId,
          buyerId: payments.buyerId,
          sellerId: payments.sellerId,
          buyerUsername: buyerU.username,
          sellerUsername: sellerU.username,
        })
        .from(payments)
        .leftJoin(buyerU, eq(buyerU.id, payments.buyerId))
        .leftJoin(sellerU, eq(sellerU.id, payments.sellerId))
        .where(eq(payments.id, body.paymentId))
        .limit(1);

      if (!p.length) return res.status(404).json({ error: "payment_not_found" });
      const pay = p[0];

      const inserted = await db
        .insert(disputes)
        .values({
          paymentId: body.paymentId,
          buyerId: pay.buyerId,
          sellerId: pay.sellerId,
          reason: body.reason ?? null,
          evidence: body.evidence ?? null,
          status: "open",
        })
        .returning();

      // listing title (اختياري)
      let listingTitle: string | null = null;
      if (pay.listingId) {
        const l = await db
          .select({ title: listings.title })
          .from(listings)
          .where(eq(listings.id, pay.listingId))
          .limit(1);
        listingTitle = l[0]?.title ?? null;
      }

      const out = shapeDisputeRow({
        ...inserted[0],
        buyerUsername: pay.buyerUsername ?? null,
        sellerUsername: pay.sellerUsername ?? null,
        listingTitle,
      });
      return res.status(201).json(out);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** GET /api/disputes/:id */
  app.get("/api/disputes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);

      const buyerU = users.as("buyer_u");
      const sellerU = users.as("seller_u");

      const rows = await db
        .select({
          id: disputes.id,
          paymentId: disputes.paymentId,
          buyerId: disputes.buyerId,
          sellerId: disputes.sellerId,
          reason: disputes.reason,
          evidence: disputes.evidence,
          status: disputes.status,
          resolution: disputes.resolution,
          resolvedAt: disputes.resolvedAt,
          createdAt: disputes.createdAt,
          updatedAt: disputes.updatedAt,
          buyerUsername: buyerU.username,
          sellerUsername: sellerU.username,
        })
        .from(disputes)
        .leftJoin(buyerU, eq(buyerU.id, disputes.buyerId))
        .leftJoin(sellerU, eq(sellerU.id, disputes.sellerId))
        .where(eq(disputes.id, id))
        .limit(1);

      if (!rows.length) return res.status(404).json({ error: "not_found" });
      const d = rows[0];

      const me = await getCurrentUser(req);
      const amAdmin = isAdminUser(me);
      if (!amAdmin && me && me.id !== d.buyerId && me.id !== d.sellerId) {
        return res.status(403).json({ error: "forbidden" });
      }

      // listing title
      let listingTitle: string | null = null;
      if (d.paymentId) {
        const p = await db.select({ listingId: payments.listingId }).from(payments).where(eq(payments.id, d.paymentId)).limit(1);
        const lId = p[0]?.listingId;
        if (lId) {
          const l = await db.select({ title: listings.title }).from(listings).where(eq(listings.id, lId)).limit(1);
          listingTitle = l[0]?.title ?? null;
        }
      }

      return res.json(shapeDisputeRow({ ...d, listingTitle }));
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** GET /api/disputes/:id/messages */
  app.get("/api/disputes/:id/messages", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);

      const d = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!d.length) return res.status(404).json({ error: "dispute_not_found" });

      const me = await getCurrentUser(req);
      const amAdmin = isAdminUser(me);
      if (!amAdmin && me && me.id !== d[0].buyerId && me.id !== d[0].sellerId) {
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

  /** POST /api/disputes/:id/messages */
  app.post("/api/disputes/:id/messages", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const text = z.string().min(1).parse(req.body?.text);

      const d = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!d.length) return res.status(404).json({ error: "dispute_not_found" });

      const me = await getCurrentUser(req);
      const amAdmin = isAdminUser(me);
      if (!amAdmin && (!me || (me.id !== d[0].buyerId && me.id !== d[0].sellerId))) {
        return res.status(403).json({ error: "forbidden" });
      }

      const row = await db
        .insert(messages)
        .values({
          disputeId: id,
          content: text,
          senderId: me?.id ?? null,
          senderUsername: amAdmin ? (me?.username || "admin").toLowerCase() : (me?.username || "").toLowerCase(),
        })
        .returning();

      return res.status(201).json(row[0]);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** POST /api/disputes/:id/resolve */
  app.post("/api/disputes/:id/resolve", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);

      const d = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!d.length) return res.status(404).json({ error: "not_found" });

      const me = await getCurrentUser(req);
      const amAdmin = isAdminUser(me);
      if (!amAdmin && (!me || (me.id !== d[0].buyerId && me.id !== d[0].sellerId))) {
        return res.status(403).json({ error: "forbidden" });
      }

      const updated = await db
        .update(disputes)
        .set({ status: "resolved", resolvedAt: new Date() })
        .where(eq(disputes.id, id))
        .returning();

      return res.json(updated[0]);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** POST /api/disputes/:id/cancel */
  app.post("/api/disputes/:id/cancel", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);

      const d = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!d.length) return res.status(404).json({ error: "not_found" });

      const me = await getCurrentUser(req);
      const amAdmin = isAdminUser(me);
      if (!amAdmin && (!me || (me.id !== d[0].buyerId && me.id !== d[0].sellerId))) {
        return res.status(403).json({ error: "forbidden" });
      }

      const updated = await db
        .update(disputes)
        .set({ status: "cancelled" })
        .where(eq(disputes.id, id))
        .returning();

      return res.json(updated[0]);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });
}