// server/routers/payouts.ts
import type { Express } from "express";
import { tgAuth } from "../middleware/tgAuth";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";

// استيراد موحّد من الإنديكس
import { users, walletBalancesView, type Payout } from "@shared/schema";

/** حساب الرصيد المتاح من الفيو wallet_balances */
async function computeBalanceByUserId(userId: string, currency = "TON") {
  const row = await db
    .select({ balance: walletBalancesView.balance })
    .from(walletBalancesView)
    .where(
      // لو عندك multi-currency وتريد تقيّد بالعملة:
      // and(eq(walletBalancesView.userId, userId as any), eq(walletBalancesView.currency, currency))
      eq(walletBalancesView.userId, userId as any)
    )
    .limit(1);

  return Number(row[0]?.balance ?? 0);
}

const MIN_WITHDRAW = Number(process.env.MIN_WITHDRAW || "0"); // 0 = بدون حد أدنى
const MAX_WITHDRAW = Number(process.env.MAX_WITHDRAW || "0"); // 0 = بدون حد أعلى

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

      // الرصيد من الـ view الجديدة
      const balance = await computeBalanceByUserId(me.id, "TON");
      if (amount > balance) {
        return res.status(400).json({ error: "insufficient_balance", balance });
      }

      // امنع وجود queued سابق
      const existing = await storage.listPayoutsBySeller(me.id);
      if (existing.some((p) => p.status === "queued")) {
        return res.status(409).json({ error: "payout_already_queued" });
      }

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

  /** جلب payout مفرد وإضافة sellerUsername بالـresponse */
  app.get("/api/payouts/:id", tgAuth, async (req, res) => {
    try {
      const p = await storage.getPayout(req.params.id);
      if (!p) return res.status(404).json({ error: "not_found" });

      const u = p.sellerId
        ? (await db
            .select({ username: users.username })
            .from(users)
            .where(eq(users.id, p.sellerId))
            .limit(1))[0]
        : undefined;

      return res.json({ ...p, sellerUsername: u?.username ?? null });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "payout_fetch_failed" });
    }
  });
}