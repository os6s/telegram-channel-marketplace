// server/routers/admin.ts
import type { Express, Request } from "express";
import { db } from "../db.js";
import { desc, eq, inArray } from "drizzle-orm";
import { tgAuth } from "../middleware/tgAuth.js";
import { storage } from "../storage";

// استيراد من الإندكس
import {
  users,
  listings,
  payments,
  activities,
  payouts,
} from "@shared/schema";

// نوع User
type User = typeof users.$inferSelect;

/* ---------- admin auth ---------- */
const ADMIN_TG = new Set(
  (process.env.ADMIN_TG_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

async function resolveActor(req: Request): Promise<User | undefined> {
  const tg = (req as any).telegramUser as { id: number } | undefined;
  if (!tg) return undefined;
  return storage.getUserByTelegramId(String(tg.id));
}

function isAdmin(u?: Pick<User, "role" | "telegramId" | "username">) {
  if (!u) return false;
  if (u.role === "admin") return true;
  const ok = u.telegramId ? ADMIN_TG.has(String(u.telegramId)) : false;
  return ok || (u.username || "").toLowerCase() === "os6s7";
}

/* ---------- mapper for payout statuses ---------- */
function mapPayoutStatus(s: string): "queued" | "sent" | "confirmed" | "failed" {
  if (s === "pending") return "queued";
  if (s === "processing") return "sent";
  if (s === "completed") return "confirmed";
  return "failed";
}

/* ---------- notify helper ---------- */
async function notify(telegramId: number | string | null | undefined, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const chatId = Number(telegramId);
  if (!Number.isFinite(chatId)) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch { /* ignore */ }
}

export function mountAdmin(app: Express) {
  /* =========================
     GET /api/admin/orders
  ========================= */
  app.get("/api/admin/orders", tgAuth, async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    const rows = await db.select().from(payments).orderBy(desc(payments.createdAt));
    if (!rows.length) return res.json([]);

    const buyerIds = Array.from(new Set(rows.map((r) => r.buyerId).filter(Boolean) as string[]));
    const sellerIds = Array.from(new Set(rows.map((r) => r.sellerId).filter(Boolean) as string[]));

    const buyers = buyerIds.length ? await db.select().from(users).where(inArray(users.id, buyerIds)) : [];
    const sellers = sellerIds.length ? await db.select().from(users).where(inArray(users.id, sellerIds)) : [];

    const buyersMap = new Map(buyers.map((u) => [u.id, u]));
    const sellersMap = new Map(sellers.map((u) => [u.id, u]));

    const out = await Promise.all(
      rows.map(async (r) => {
        let listingTitle: string | null = null;
        if (r.listingId) {
          const l = (await db.select().from(listings).where(eq(listings.id, r.listingId)).limit(1))[0];
          if (l) listingTitle = l.title ?? null;
        }

        const buyer = buyersMap.get(r.buyerId);
        const seller = sellersMap.get(r.sellerId);

        return {
          id: r.id,
          listingId: r.listingId,
          listingTitle,
          createdAt: r.createdAt as unknown as string,
          amount: String(r.amount),
          currency: (r.currency as string) || "TON",
          status: r.status,
          adminAction: r.adminAction,
          buyer: { id: r.buyerId, username: buyer?.username ?? null },
          seller: { id: r.sellerId, username: seller?.username ?? null },
        };
      })
    );

    res.json(out);
  });

  /* =========================
     POST /api/admin/payments/:id/release
  ========================= */
  app.post("/api/admin/payments/:id/release", tgAuth, async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    const pid = req.params.id;
    const pay = (await db.select().from(payments).where(eq(payments.id, pid)).limit(1))[0];
    if (!pay) return res.status(404).json({ error: "Payment not found" });

    await db
      .update(payments)
      .set({ status: "released", adminAction: "release", confirmedAt: new Date() })
      .where(eq(payments.id, pid));

    await notify(pay.buyerId, `✅ Order Released`);
    await notify(pay.sellerId, `✅ Payout Released`);

    res.json({ ok: true });
  });

  /* =========================
     POST /api/admin/payments/:id/refund
  ========================= */
  app.post("/api/admin/payments/:id/refund", tgAuth, async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    const pid = req.params.id;
    const pay = (await db.select().from(payments).where(eq(payments.id, pid)).limit(1))[0];
    if (!pay) return res.status(404).json({ error: "Payment not found" });

    await db
      .update(payments)
      .set({ status: "refunded", adminAction: "refund", confirmedAt: new Date() })
      .where(eq(payments.id, pid));

    await notify(pay.buyerId, `↩️ Order Refunded`);
    await notify(pay.sellerId, `⚠️ Order Refunded`);

    res.json({ ok: true });
  });

  /* =========================
     GET /api/admin/payouts
  ========================= */
  app.get("/api/admin/payouts", tgAuth, async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    const rows = await db.select().from(payouts).orderBy(desc(payouts.createdAt));

    const sellerIds = rows.map((r) => r.sellerId);
    const sellers = sellerIds.length ? await db.select().from(users).where(inArray(users.id, sellerIds)) : [];
    const sellersMap = new Map(sellers.map((u) => [u.id, u]));

    const out = rows.map((p) => ({
      id: p.id,
      paymentId: p.paymentId,
      sellerId: p.sellerId,
      toAddress: p.toAddress,
      amount: String(p.amount),
      currency: p.currency,
      status: mapPayoutStatus(p.status),
      txHash: p.txHash,
      createdAt: p.createdAt as unknown as string,
      sentAt: p.sentAt as unknown as string,
      confirmedAt: p.confirmedAt as unknown as string,
      seller: { id: p.sellerId, username: sellersMap.get(p.sellerId)?.username ?? null },
    }));

    res.json(out);
  });

  /* =========================
     POST /api/admin/payouts/:id/sent
  ========================= */
  app.post("/api/admin/payouts/:id/sent", tgAuth, async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    const id = req.params.id;
    const [p] = await db
      .update(payouts)
      .set({ status: "processing", sentAt: new Date() })
      .where(eq(payouts.id, id))
      .returning();

    if (!p) return res.status(404).json({ error: "Payout not found" });

    res.json({ ...p, status: mapPayoutStatus(p.status) });
  });

  /* =========================
     POST /api/admin/payouts/:id/confirm
  ========================= */
  app.post("/api/admin/payouts/:id/confirm", tgAuth, async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor || !isAdmin(actor)) return res.status(403).json({ error: "Admin only" });

    const id = req.params.id;
    const [p] = await db
      .update(payouts)
      .set({ status: "completed", confirmedAt: new Date() })
      .where(eq(payouts.id, id))
      .returning();

    if (!p) return res.status(404).json({ error: "Payout not found" });

    res.json({ ...p, status: mapPayoutStatus(p.status) });
  });
}