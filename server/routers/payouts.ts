// server/routers/payouts.ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";
import { payouts, walletBalancesView, walletLedger, users } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const createPayoutSchema = z.object({
  amount: z.number().positive(),
  toAddress: z.string().min(10).max(128), // عنوان محفظة TON
  note: z.string().optional(),
});

async function getMe(req: Request) {
  const tg = (req as any).telegramUser as { id?: number; username?: string } | undefined;
  if (!tg?.id) return null;
  const me = await db.query.users.findFirst({ where: eq(users.telegramId, BigInt(tg.id)) });
  return me ?? null;
}

const ADMIN_TG_IDS = (process.env.ADMIN_TG_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function mountPayouts(app: Express) {
  /** User: Create payout request */
  app.post("/api/payouts", tgAuth, async (req: Request, res: Response) => {
    try {
      const me = await getMe(req);
      if (!me) return res.status(401).json({ error: "unauthorized" });

      const body = createPayoutSchema.parse(req.body);

      // Check balance
      const row = await db
        .select()
        .from(walletBalancesView)
        .where(eq(walletBalancesView.userId, me.id))
        .limit(1);

      const balanceNum = Number(row[0]?.balance ?? 0);
      if (balanceNum < body.amount) {
        return res.status(400).json({ error: "insufficient_balance" });
      }

      // Insert payout
      const [p] = await db
        .insert(payouts)
        .values({
          sellerId: me.id,
          toAddress: body.toAddress,
          amount: String(body.amount),
          currency: "TON",
          status: "pending",
          note: body.note ?? null,
        })
        .returning();

      // Ledger entry: lock funds
      await db.insert(walletLedger).values({
        userId: me.id,
        direction: "out",
        amount: String(body.amount),
        currency: "TON",
        refType: "payout_request",
        refId: p.id,
        note: "User requested payout",
      });

      res.status(201).json(p);
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** User: Get my payout requests */
  app.get("/api/payouts/me", tgAuth, async (req: Request, res: Response) => {
    try {
      const me = await getMe(req);
      if (!me) return res.status(401).json({ error: "unauthorized" });

      const rows = await db
        .select()
        .from(payouts)
        .where(eq(payouts.sellerId, me.id))
        .orderBy(desc(payouts.createdAt));

      res.json(rows);
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** Admin: List all payout requests */
  app.get("/api/payouts", tgAuth, async (req: Request, res: Response) => {
    try {
      const tg = (req as any).telegramUser;
      if (!tg?.id || !ADMIN_TG_IDS.includes(String(tg.id))) {
        return res.status(403).json({ error: "forbidden" });
      }

      const rows = await db.select().from(payouts).orderBy(desc(payouts.createdAt));
      res.json(rows);
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });

  /** Admin: Update payout status (processing/completed/failed) */
  app.patch("/api/payouts/:id", tgAuth, async (req: Request, res: Response) => {
    try {
      const tg = (req as any).telegramUser;
      if (!tg?.id || !ADMIN_TG_IDS.includes(String(tg.id))) {
        return res.status(403).json({ error: "forbidden" });
      }

      const id = String(req.params.id);
      const { status, txHash, note } = req.body || {};

      if (!["processing", "completed", "failed"].includes(status)) {
        return res.status(400).json({ error: "invalid_status" });
      }

      const [updated] = await db
        .update(payouts)
        .set({
          status,
          txHash: txHash ?? null,
          note: note ?? null,
          sentAt: status === "processing" ? new Date() : undefined,
          confirmedAt: status === "completed" ? new Date() : undefined,
        })
        .where(eq(payouts.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: "not_found" });

      // If failed → return funds to user
      if (status === "failed") {
        await db.insert(walletLedger).values({
          userId: updated.sellerId,
          direction: "in",
          amount: String(updated.amount),
          currency: "TON",
          refType: "payout_refund",
          refId: updated.id,
          note: "Refund from failed payout",
        });
      }

      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "invalid_request" });
    }
  });
}