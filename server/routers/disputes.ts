// server/routers/disputes.ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, desc, or } from "drizzle-orm";
import { db } from "../db.js";
import { tgOptionalAuth, requireTelegramUser } from "../middleware/tgAuth.js";
import {
  disputes,
  disputesView,
  messages,
  listings,
  payments,
  users,
  walletLedger,
} from "@shared/schema";

/* ========================= Schemas ========================= */
const idParam = z.object({ id: z.string().uuid() });
const createDisputeSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().optional(),
  evidence: z.string().optional(),
});

/* ========================= Helpers ========================= */
async function getCurrentUser(req: Request) {
  const tg = (req as any).telegramUser as { id?: number; username?: string } | undefined;
  if (tg?.id) {
    const byTg = await db.query.users.findFirst({ where: eq(users.telegramId, Number(tg.id)) });
    if (byTg) return byTg;
  }
  if (tg?.username) {
    const u = await db.query.users.findFirst({
      where: eq(users.username, tg.username.toLowerCase()),
    });
    if (u) return u;
  }
  return null;
}

const ADMIN_TG_IDS: number[] = (process.env.ADMIN_TG_IDS || "")
  .split(",")
  .map((x) => Number(x.trim()))
  .filter((x) => Number.isFinite(x));

const isAdminUser = (u: any | null) =>
  !!u && (u.role === "admin" || u.role === "moderator" || ADMIN_TG_IDS.includes(Number(u.telegramId)));

/* ========================= Routes ========================= */
export function mountDisputes(app: Express) {
  app.use("/api/disputes", tgOptionalAuth);

  /** GET /api/disputes */
  app.get("/api/disputes", async (req: Request, res: Response) => {
    try {
      const me = await getCurrentUser(req);
      if (!me) return res.status(401).json({ error: "unauthorized" });

      const amAdmin = isAdminUser(me);
      if (amAdmin) {
        const list = await db.select().from(disputesView).orderBy(desc(disputesView.createdAt));
        return res.json(list);
      }

      const list = await db
        .select()
        .from(disputesView)
        .where(or(eq(disputesView.buyerId, me.id), eq(disputesView.sellerId, me.id)))
        .orderBy(desc(disputesView.createdAt));

      return res.json(list);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "server_error" });
    }
  });

  /** POST /api/disputes */
  app.post("/api/disputes", requireTelegramUser, async (req: Request, res: Response) => {
    try {
      const me = await getCurrentUser(req);
      if (!me) return res.status(401).json({ error: "unauthorized" });

      const body = createDisputeSchema.parse(req.body ?? {});

      const p = await db
        .select({
          id: payments.id,
          listingId: payments.listingId,
          buyerId: payments.buyerId,
          sellerId: payments.sellerId,
        })
        .from(payments)
        .where(eq(payments.id, body.paymentId))
        .limit(1);

      if (!p.length) return res.status(404).json({ error: "payment_not_found" });
      const pay = p[0];

      // only buyer or seller can create
      if (me.id !== pay.buyerId && me.id !== pay.sellerId) {
        return res.status(403).json({ error: "forbidden", detail: "not_participant" });
      }

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

      let listingTitle: string | null = null;
      if (pay.listingId) {
        const l = await db
          .select({ title: listings.title })
          .from(listings)
          .where(eq(listings.id, pay.listingId))
          .limit(1);
        listingTitle = l[0]?.title ?? null;
      }

      const row = await db
        .select()
        .from(disputesView)
        .where(eq(disputesView.id, inserted[0].id))
        .limit(1);

      return res.status(201).json({ ...row[0], listingTitle });
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** GET /api/disputes/:id */
  app.get("/api/disputes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const rows = await db.select().from(disputesView).where(eq(disputesView.id, id)).limit(1);
      if (!rows.length) return res.status(404).json({ error: "not_found" });
      const d = rows[0];

      const me = await getCurrentUser(req);
      if (!me) return res.status(401).json({ error: "unauthorized" });

      const amAdmin = isAdminUser(me);
      if (!amAdmin && me.id !== d.buyerId && me.id !== d.sellerId) {
        return res.status(403).json({ error: "forbidden" });
      }

      return res.json(d);
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
      if (!me) return res.status(401).json({ error: "unauthorized" });

      const amAdmin = isAdminUser(me);
      if (!amAdmin && me.id !== d[0].buyerId && me.id !== d[0].sellerId) {
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
  app.post("/api/disputes/:id/messages", requireTelegramUser, async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);
      const text = z.string().min(1).parse(req.body?.text);

      const d = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!d.length) return res.status(404).json({ error: "dispute_not_found" });

      const me = await getCurrentUser(req);
      if (!me) return res.status(401).json({ error: "unauthorized" });

      const amAdmin = isAdminUser(me);
      if (!amAdmin && me.id !== d[0].buyerId && me.id !== d[0].sellerId) {
        return res.status(403).json({ error: "forbidden" });
      }

      const row = await db
        .insert(messages)
        .values({
          disputeId: id,
          content: text.trim(),
          senderId: me.id,
          senderUsername: me.username?.toLowerCase() || "unknown",
        })
        .returning();

      return res.status(201).json(row[0]);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** POST /api/disputes/:id/resolve (admin only) */
  app.post("/api/disputes/:id/resolve", requireTelegramUser, async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);

      const d = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!d.length) return res.status(404).json({ error: "not_found" });

      const me = await getCurrentUser(req);
      if (!me) return res.status(401).json({ error: "unauthorized" });
      const amAdmin = isAdminUser(me);
      if (!amAdmin) return res.status(403).json({ error: "forbidden" });

      const pay = await db.query.payments.findFirst({ where: eq(payments.id, d[0].paymentId) });
      if (!pay || pay.status !== "escrow") {
        return res.status(404).json({ error: "payment_not_in_escrow" });
      }

      const action = String(req.body?.action || "release");
      if (!["release", "refund"].includes(action)) {
        return res.status(400).json({ error: "bad_request" });
      }

      const amount = Number(pay.amount);
      if (action === "release") {
        const fee = +(amount * 0.05).toFixed(9);
        const sellerAmount = +(amount - fee).toFixed(9);

        await db.insert(walletLedger).values([
          {
            userId: pay.sellerId,
            direction: "in",
            amount: String(sellerAmount),
            currency: "TON",
            refType: "payout",
            refId: pay.id,
            note: "Released to seller",
          },
          {
            userId: me.id, // admin user
            direction: "in",
            amount: String(fee),
            currency: "TON",
            refType: "fee",
            refId: pay.id,
            note: "Admin fee",
          },
        ]);

        await db.update(payments).set({
          feePercent: "5",
          feeAmount: String(fee),
          sellerAmount: String(sellerAmount),
          status: "released",
          adminAction: "release",
        }).where(eq(payments.id, pay.id));
      }

      if (action === "refund") {
        await db.insert(walletLedger).values({
          userId: pay.buyerId,
          direction: "in",
          amount: String(amount),
          currency: "TON",
          refType: "refund",
          refId: pay.id,
          note: "Refunded to buyer",
        });

        await db.update(payments).set({
          status: "refunded",
          adminAction: "refund",
        }).where(eq(payments.id, pay.id));
      }

      const updated = await db.update(disputes).set({
        status: "resolved",
        resolvedAt: new Date(),
      }).where(eq(disputes.id, id)).returning();

      return res.json({ ok: true, dispute: updated[0], action });
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** POST /api/disputes/:id/cancel */
  app.post("/api/disputes/:id/cancel", requireTelegramUser, async (req: Request, res: Response) => {
    try {
      const { id } = idParam.parse(req.params);

      const d = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
      if (!d.length) return res.status(404).json({ error: "not_found" });

      const me = await getCurrentUser(req);
      if (!me) return res.status(401).json({ error: "unauthorized" });

      const dispute = d[0];
      if (me.id !== dispute.buyerId && me.id !== dispute.sellerId) {
        return res.status(403).json({ error: "forbidden" });
      }

      const updated = await db.update(disputes).set({
        status: "cancelled",
      }).where(eq(disputes.id, id)).returning();

      return res.json({ ok: true, dispute: updated[0], action: "closed_only" });
    } catch (e: any) {
      return res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });
}
