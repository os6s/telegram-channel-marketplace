// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";

import { registerBotRoutes } from "./telegram-bot";
import { mountWebhook } from "./routers/webhook";
import { mountUsers } from "./routers/users";
import { mountListings } from "./routers/listings";
import { mountChannels } from "./routers/channels";
import { mountActivities } from "./routers/activities";
import { mountPayments } from "./routers/payments";
import { mountDisputes } from "./routers/disputes";
import { mountDisputeMessages } from "./routers/messages";
import { mountWallet } from "./routers/wallet";
import { mountProfile } from "./routers/profile";
import { mountBalance } from "./routers/balance";
import { mountPayouts } from "./routers/payouts";
import { mountAdmin } from "./routers/admin";
import { mountAdminPayouts } from "./routers/admin-payouts";
import { mountStats } from "./routers/stats";
import { mountMisc } from "./routers/misc";

const WEBAPP_URL = process.env.WEBAPP_URL!; // مطلوب في Render

export async function registerRoutes(app: Express): Promise<Server> {
  // 1) Webhook + /api/config (أولاً)
  mountWebhook(app, WEBAPP_URL);

  // 2) مسارات البوت (تفعل فقط عند وجود TELEGRAM_BOT_TOKEN)
  registerBotRoutes(app);

  // 3) REST APIs (ترتيب منطقي)
  mountUsers(app);
  mountListings(app);
  mountChannels(app);
  mountActivities(app);

  // رصيد/محفظة/سحب
  mountWallet(app);
  mountProfile(app);
  mountBalance(app);
  mountPayouts(app);

  // مدفوعات الطلبات من الرصيد
  mountPayments(app);

  // نزاعات ورسائلها
  mountDisputes(app);
  mountDisputeMessages(app);

  // لوحات الأدمن
  mountAdmin(app);
  mountAdminPayouts(app);

  // إحصائيات ومتفرقات أخيراً
  mountStats(app);
  mountMisc(app);

  return createServer(app);
}