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
import { mountStats } from "./routers/stats";
import { mountMisc } from "./routers/misc";

const WEBAPP_URL = process.env.WEBAPP_URL!; // لازم تكون مضبوطة في Render

export async function registerRoutes(app: Express): Promise<Server> {
  // 1) webhook + /api/config (webhook لازم يتركب أولاً)
  mountWebhook(app, WEBAPP_URL);

  // 2) مسارات البوت (تفعل فقط إذا TELEGRAM_BOT_TOKEN موجود)
  registerBotRoutes(app);

  // 3) REST APIs
  mountUsers(app);
  mountListings(app);
  mountChannels(app);
  mountActivities(app);
  mountPayments(app);
  mountDisputes(app);
  mountDisputeMessages(app);
  mountWallet(app);
  mountStats(app);
  mountMisc(app);

  return createServer(app);
}