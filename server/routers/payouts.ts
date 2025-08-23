// server/routers/payouts.ts
import type { Express } from "express";
import { tgAuth } from "../middleware/tgAuth";
import { storage } from "../storage";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Payout } from "@shared/schema";

/** الرصيد المتاح = deposits(paid) - orders(locked & pending/paid)
 *  نعتمد على buyerUsername للرصيد فقط (لا نخزن usernames في payouts)
 */
async function computeBalance(buyerUsername: string) {
  const pays = await storage.listPaymentsByBuyerUsername(buyerUsername);
  const deposits = +pays
    .filter((p) => p.kind === "deposit" && p.status === "paid")
    .reduce((s, p) => s + Number(p.amount || 0), 0)
    .toFixed(9);

  const locked = +pays
    .filter(
      (p) =>
        p.kind === "order" &&
        p.locked &&
        (p.status === "pending" || p.status === "paid")
    )
    .reduce((s, p) => s + Number(p.amount || 0), 0)
    .toFixed(9);

  return +(deposits - locked).toFixed(9);
}

const MIN_WITHDRAW = Number(process.env.MIN_WITHDRAW || "0"); // اختياري
const MAX_WITHDRAW = Number(process.env.MAX_WITHDRAW || "0"); // اختياري (0 = بدون حد)

export function mountPayouts(app: Express) {
  /** إنشاء طلب سحب — يخزّن IDs فقط ويرجع sellerUsername في الـresponse */
  app.post("/api/payouts/request", tgAuth, async (req, res) => {
    try {
      const me = await storage.getUserByTelegramId(String((req as any).telegramUser.id));
      if (!me) return res.status(404).json({ error: "user_not_found" });
      if ((me as any).isBanned) return res.status(403).json({ error: "user_banned" });

      const uname = (me.username || "").trim();
      if (!uname) return res.status(400).json({ error: "username_required" });

      const addr = me.walletAddress;
      if (!addr) return res.status(400).json({ error: "wallet_required" });

      const rawAmount = String(req.body?.amount ?? "");
      const amount = Number(rawAmount.replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "invalid_amount" });
      }
      if (MIN_WITHDRAW > 0 && amount < MIN_WITHDRAW) {
        return res.status(400).json({ error: "below_min_withdraw", min: MIN_WITHDRAW });
      }
      if (MAX_WITHDRAW > 0 && amount > MAX_WITHDRAW) {
        return res.status(400).json({ error: "above_max_withdraw", max: MAX_WITHDRAW });
      }

      const balance = await computeBalance(uname);
      if (amount > balance) {
        return res.status(400).json({ error: "insufficient_balance", balance });
      }

      // امنع وجود queued سابق
      const existing = await storage.listPayoutsBySeller(me.id);
      if (existing.some((p) => p.status === "queued")) {
        return res.status(409).json({ error: "payout_already_queued" });
      }

      // نخزّن sellerId فقط
      const created = await storage.createPayout({
        paymentId: null,
        sellerId: me.id,
        toAddress: addr,
        amount: amount.toFixed(9),
        currency: "TON",
        status: "queued",
        note: "user_withdrawal",
        txHash: null,
      });

      // نضيف sellerUsername في الـresponse فقط (لا يُخزَّن)
      res.status(201).json({ ...created, sellerUsername: me.username ?? null });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "payout_request_failed" });
    }
  });

  /** قائمة طلبات السحب الخاصة بي — IDs في DB، ونعرض sellerUsername عبر join */
  app.get("/api/payouts/my", tgAuth, async (req, res) => {
    try {
      const me = await storage.getUserByTelegramId(String((req as any).telegramUser.id));
      if (!me) return res.status(404).json({ error: "user_not_found" });

      const rows = await storage.listPayoutsBySeller(me.id);
      // enrich بـ sellerUsername (من users)
      const out = rows
        .sort(
          (a: Payout, b: Payout) =>
            new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
        )
        .map((p) => ({ ...p, sellerUsername: me.username ?? null }));

      res.json(out);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "payouts_fetch_failed" });
    }
  });

  /** (اختياري) جلب payout مفرد وإضافة sellerUsername بالـresponse */
  app.get("/api/payouts/:id", tgAuth, async (req, res) => {
    try {
      const p = await storage.getPayout(req.params.id);
      if (!p) return res.status(404).json({ error: "not_found" });

      // fetch seller username via join
      const u = p.sellerId
        ? (await db.select({ username: users.username }).from(users).where(eq(users.id, p.sellerId)).limit(1))[0]
        : undefined;

      return res.json({ ...p, sellerUsername: u?.username ?? null });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "payout_fetch_failed" });
    }
  });
}