// server/routers/balance.ts
import type { Express, Request, Response } from "express";
import { requireTelegramUser as tgAuth } from "../middleware/tgAuth.js";
import { db } from "../db.js";
import { users, payments } from "@shared/schema";
import { eq } from "drizzle-orm";

type TgUser = { id: number };

function sum(nums: (string | number | null | undefined)[]) {
  return +nums.reduce((s, v) => s + Number(v || 0), 0).toFixed(9);
}

async function getMe(req: Request) {
  const tg = (req as any).telegramUser as TgUser | undefined;
  if (!tg?.id) return null;
  // telegram_id هو BIGINT؛ وضعناه كـ number في Drizzle
  return await db.query.users.findFirst({ where: eq(users.telegramId, Number(tg.id)) });
}

export function mountBalance(app: Express) {
  app.get("/api/me/balance", tgAuth, async (req: Request, res: Response) => {
    const me = await getMe(req);
    if (!me) return res.status(404).json({ error: "user_not_found" });

    const rows = await db.query.payments.findMany({
      where: eq(payments.buyerId, me.id),
      columns: {
        amount: true,
        kind: true,
        status: true,
        locked: true,
      },
    });

    const deposits = sum(rows.filter(r => r.kind === "deposit" && r.status === "paid").map(r => r.amount));
    const locked   = sum(rows.filter(r =>
      r.kind === "order" && !!r.locked && (r.status === "pending" || r.status === "paid")
    ).map(r => r.amount));
    const balance  = +(deposits - locked).toFixed(9);

    res.json({ currency: "TON", deposits, locked, balance });
  });
}