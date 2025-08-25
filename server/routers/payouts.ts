import type { Express, Request, Response } from "express";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";
import { db } from "../db.js";
import { payouts, walletBalancesView, walletLedger } from "@shared/schema";
import { eq } from "drizzle-orm";
import { notifyUser } from "../telegram-bot.js";

const ADMIN_TG_IDS: number[] = (process.env.ADMIN_TG_IDS || "")
  .split(",")
  .map((x) => Number(x.trim()))
  .filter((x) => Number.isFinite(x));

async function getMe(req: Request) {
  return (req as any).telegramUser;
}

export function mountPayouts(app: Express) {
  /** 1) يطلب المستخدم سحب */
  app.post("/api/payouts", tgAuth, async (req: Request, res: Response) => {
    try {
      const me = await getMe(req);
      if (!me?.id) return res.status(401).json({ error: "unauthorized" });

      const { amount, address } = req.body || {};
      const amt = Number(amount);
      if (!amt || amt <= 0) return res.status(400).json({ error: "invalid_amount" });
      if (!address) return res.status(400).json({ error: "address_required" });

      // تحقق من الرصيد
      const row = await db
        .select()
        .from(walletBalancesView)
        .where(eq(walletBalancesView.userId, me.id))
        .limit(1);

      const balanceNum = Number(row[0]?.balance ?? 0);
      if (balanceNum < amt) {
        return res.status(400).json({ error: "insufficient_balance" });
      }

      // نسجل payout
      const [payout] = await db
        .insert(payouts)
        .values({
          userId: me.id,
          amount: String(amt),
          currency: "TON",
          address,
          status: "pending",
        })
        .returning();

      // نقص من الـ ledger
      await db.insert(walletLedger).values({
        userId: me.id,
        direction: "out",
        amount: String(amt),
        currency: "TON",
        refType: "payout",
        refId: payout.id,
        note: "Withdraw request",
      });

      // إشعار للأدمن
      for (const adminId of ADMIN_TG_IDS) {
        await notifyUser(
          adminId,
          `💸 <b>New Payout Request</b>\n\nUser: ${me.username || me.id}\nAmount: ${amt} TON\nAddress: ${address}\n\n/status ${payout.id}`
        );
      }

      res.json({ ok: true, payout });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "payout_failed" });
    }
  });

  /** 2) الأدمن يحدّث حالة السحب */
  app.post("/api/payouts/:id/status", tgAuth, async (req: Request, res: Response) => {
    try {
      const me = await getMe(req);
      if (!me?.id || !ADMIN_TG_IDS.includes(Number(me.id))) {
        return res.status(403).json({ error: "forbidden" });
      }

      const { id } = req.params;
      const { status } = req.body || {};
      if (!["completed", "failed"].includes(status)) {
        return res.status(400).json({ error: "bad_status" });
      }

      const updated = await db
        .update(payouts)
        .set({ status, updatedAt: new Date() })
        .where(eq(payouts.id, id))
        .returning();

      res.json({ ok: true, payout: updated[0] });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "payout_update_failed" });
    }
  });
}