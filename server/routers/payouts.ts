// server/routers/payouts.ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";
import { payouts, walletBalancesView, walletLedger, users } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { Address } from "@ton/core"; // ✅ for TON address validation

// ------------------ utils ------------------
const createPayoutSchema = z.object({
  amount: z.number().positive(),
  toAddress: z.string().min(10).max(128), // further validated with ton-core
  note: z.string().optional(),
});

async function getMe(req: Request) {
  const tg = (req as any).telegramUser as { id?: number; username?: string } | undefined;
  if (!tg?.id) return null;
  return await db.query.users.findFirst({
    where: eq(users.telegramId, BigInt(tg.id)),
  });
}

function isValidTonAddress(addr: string): boolean {
  try {
    Address.parse(addr.trim());
    return true;
  } catch {
    return false;
  }
}

const ADMIN_TG_IDS = (process.env.ADMIN_TG_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ------------------ router ------------------
export function mountPayouts(app: Express) {
  /** User: Create payout request */
  app.post("/api/payouts", tgAuth, async (req: Request, res: Response) => {
    try {
      const me = await getMe(req);
      if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

      const body = createPayoutSchema.parse(req.body);

      if (!isValidTonAddress(body.toAddress)) {
        return res.status(400).json({ ok: false, error: "invalid_address" });
      }

      // Check balance
      const row = await db
        .select()
        .from(walletBalancesView)
        .where(eq(walletBalancesView.userId, me.id))
        .limit(1);

      const balanceNum = Number(row[0]?.balance ?? 0);
      if (balanceNum < body.amount) {
        return res.status(400).json({ ok: false, error: "insufficient_balance" });
      }

      // Insert payout (status=pending)
      const [payout] = await db
        .insert(payouts)
        .values({
          userId: me.id,
          toAddress: body.toAddress.trim(),
          amount: String(body.amount),
          currency: "TON",
          status: "pending",
          note: body.note ?? null,
        })
        .returning();

      // ⚠️ Do NOT deduct balance yet → only lock logically

      return res.status(201).json({ ok: true, payout });
    } catch (e: any) {
      return res.status(400).json({ ok: false, error: e?.message ?? "invalid_request" });
    }
  });

  /** User: Get my payout requests */
  app.get("/api/payouts/me", tgAuth, async (req: Request, res: Response) => {
    try {
      const me = await getMe(req);
      if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

      const rows = await db
        .select()
        .from(payouts)
        .where(eq(payouts.userId, me.id))
        .orderBy(desc(payouts.createdAt));

      return res.json({ ok: true, rows });
    } catch (e: any) {
      return res.status(400).json({ ok: false, error: e?.message ?? "invalid_request" });
    }
  });

  /** Admin: List all payout requests */
  app.get("/api/payouts", tgAuth, async (req: Request, res: Response) => {
    try {
      const tg = (req as any).telegramUser;
      if (!tg?.id || !ADMIN_TG_IDS.includes(String(tg.id))) {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }

      const rows = await db.select().from(payouts).orderBy(desc(payouts.createdAt));
      return res.json({ ok: true, rows });
    } catch (e: any) {
      return res.status(400).json({ ok: false, error: e?.message ?? "invalid_request" });
    }
  });

  /** Admin: Update payout status (processing/completed/failed) */
  app.patch("/api/payouts/:id", tgAuth, async (req: Request, res: Response) => {
    try {
      const tg = (req as any).telegramUser;
      if (!tg?.id || !ADMIN_TG_IDS.includes(String(tg.id))) {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }

      const id = String(req.params.id);
      const { status, txHash, note } = req.body || {};

      if (!["processing", "completed", "failed"].includes(status)) {
        return res.status(400).json({ ok: false, error: "invalid_status" });
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

      if (!updated) return res.status(404).json({ ok: false, error: "not_found" });

      // ✅ Ledger updates only on final result
      if (status === "completed") {
        await db.insert(walletLedger).values({
          userId: updated.userId,
          direction: "out",
          amount: String(updated.amount),
          currency: "TON",
          refType: "payout",
          refId: updated.id,
          note: "Payout completed",
        });
      }

      if (status === "failed") {
        await db.insert(walletLedger).values({
          userId: updated.userId,
          direction: "in",
          amount: String(updated.amount),
          currency: "TON",
          refType: "payout_refund",
          refId: updated.id,
          note: "Refund from failed payout",
        });
      }

      return res.json({ ok: true, payout: updated });
    } catch (e: any) {
      return res.status(400).json({ ok: false, error: e?.message ?? "invalid_request" });
    }
  });
}
