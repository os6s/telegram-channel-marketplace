// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";

import { registerBotRoutes } from "./telegram-bot";
import { mountWebhook } from "./routers/webhook";
import { mountUsers } from "./routers/users";
import { mountListings } from "./routers/listings";
import { mountActivities } from "./routers/activities";
import { mountPayments } from "./routers/payments";
import { mountDisputes } from "./routers/disputes";
import { mountDisputeMessages } from "./routers/messages";
import { mountWallet } from "./routers/wallet";
import { mountProfile } from "./routers/profile";
import { mountBalance } from "./routers/balance";
import { mountPayouts } from "./routers/payouts";
import { mountAdmin } from "./routers/admin";
import { mountStats } from "./routers/stats";
import { mountMisc } from "./routers/misc";
import { mountMarketActivity } from "./routers/market-activity";

/* ---------- env & helpers ---------- */
const WEBAPP_URL = process.env.WEBAPP_URL!; // keep Render-required
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || WEBAPP_URL;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || process.env.SESSION_SECRET || "";

function webhookUrl() {
  return `${PUBLIC_BASE_URL.replace(/\/+$/, "")}/webhook/telegram`;
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
    const info = await infoRes.json().catch(() => ({}));
    const curUrl = info?.result?.url as string | undefined;

    if (curUrl !== needUrl) {
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: needUrl, ...(needSecret ? { secret_token: needSecret } : {}) }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) {
        console.log("✅ Webhook configured successfully");
      } else {
        console.error("❌ setWebhook failed:", j);
      }
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
  // 1) Webhook + /api/config
  mountWebhook(app, WEBAPP_URL);

  // 2) Telegram bot extra routes (optional)
  registerBotRoutes(app);

  // 3) REST APIs
  mountUsers(app);
  mountListings(app);
  mountActivities(app);

  // Wallet / Profile / Balance / Payouts
  mountWallet(app);
  mountProfile(app);
  mountBalance(app);
  mountPayouts(app);

  // Payments (escrow)
  mountPayments(app);

  // Disputes & messages
  mountDisputes(app);
  mountDisputeMessages(app);

  // Admin
  mountAdmin(app);

  // Stats & misc
  mountStats(app);
  mountMisc(app);

  // Market activity timeline
  mountMarketActivity(app);

  // Try to (re)register webhook on boot
  ensureWebhook().catch(() => {});

  return createServer(app);
}