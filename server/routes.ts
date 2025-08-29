// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";

import { mountWebhook } from "./routers/webhook";
import { mountUsers } from "./routers/users";
import { mountListings } from "./routers/listings";
import { mountActivities } from "./routers/activities/index";
import { mountPayments } from "./routers/payments";
import { mountDisputes } from "./routers/disputes";
// import { mountDisputeMessages } from "./routers/messages";
import walletRouter from "./routers/wallet";
import { mountProfile } from "./routers/profile";
import { mountBalance } from "./routers/balance";
import { mountPayouts } from "./routers/payouts";
import { mountAdmin } from "./routers/admin";
import { mountStats } from "./routers/stats";
import { mountMisc } from "./routers/misc";
import { mountMarketActivity } from "./routers/market-activity";

/* ---------- env & helpers ---------- */
const WEBAPP_URL = process.env.WEBAPP_URL!;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || WEBAPP_URL).replace(/\/+$/, "");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || process.env.SESSION_SECRET || "";

function webhookUrl() {
  return `${PUBLIC_BASE_URL}/webhook/telegram`;
}

async function ensureWebhook(): Promise<void> {
  if (!BOT_TOKEN) {
    console.warn("[webhook] TELEGRAM_BOT_TOKEN not set — skip auto-registration");
    return;
  }
  const needUrl = webhookUrl();
  const needSecret = WEBHOOK_SECRET || undefined;

  try {
    const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const info = await infoRes.json().catch(() => ({} as any));
    const curUrl = info?.result?.url as string | undefined;

    if (curUrl !== needUrl) {
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: needUrl, ...(needSecret ? { secret_token: needSecret } : {}) }),
      });
      const j = await r.json().catch(() => ({} as any));
      if (!j?.ok) console.error("❌ setWebhook failed:", j);
      return;
    }

    if (needSecret) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: needUrl, secret_token: needSecret, drop_pending_updates: false }),
      }).catch(() => {});
    }

    console.log(`🔗 Webhook already set (${curUrl})`);
  } catch (e) {
    console.error("❌ ensureWebhook error:", e);
  }
}

/* ---------- register routes ---------- */
console.log("[routes] WEBAPP_URL =", WEBAPP_URL);
console.log("[routes] PUBLIC_BASE_URL =", PUBLIC_BASE_URL);

export async function registerRoutes(app: Express): Promise<Server> {
  // Webhook only (no polling)
  mountWebhook(app, WEBAPP_URL);

  // REST
  mountUsers(app);
  mountListings(app);
  mountActivities(app);

  // Wallet / Profile / Balance / Payouts
  app.use("/api/wallet", walletRouter);
  mountProfile(app);
  mountBalance(app);
  mountPayouts(app);

  // Payments & Disputes
  mountPayments(app);
  mountDisputes(app);
  // mountDisputeMessages(app);

  // Admin
  mountAdmin(app);

  // Stats / misc / activity
  mountStats(app);
  mountMisc(app);
  mountMarketActivity(app);

  ensureWebhook().catch(() => {});
  return createServer(app);
}