// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";

import { registerBotRoutes } from "./telegram-bot";
import { mountWebhook } from "./routers/webhook";
import { mountUsers } from "./routers/users";
import { mountListings } from "./routers/listings";
import { mountChannels } from "./routers/channels";
import { mountActivities } from "./routers/activities";
import { mountStats } from "./routers/stats";
import { mountMisc } from "./routers/misc";
import { mountDisputes } from "./routers/disputes";
import { mountDisputeMessages } from "./routers/messages";
import { mountWallet } from "./routers/wallet";
// ✨ جديد: راوتر الأدمن
import { mountAdmin } from "./routers/admin";

const WEBAPP_URL = process.env.WEBAPP_URL!; // required in prod

export async function registerRoutes(app: Express): Promise<Server> {
  // 1) webhook + /api/config
  mountWebhook(app, WEBAPP_URL);

  // 2) bot routes
  registerBotRoutes(app);

  // 3) APIs
  mountUsers(app);
  mountListings(app);
  mountChannels(app);
  mountActivities(app);

  mountDisputes(app);
  mountDisputeMessages(app);

  // ✨ wallet
  mountWallet(app);

  // ✨ admin
  mountAdmin(app);

  mountStats(app);
  mountMisc(app);

  return createServer(app);
}