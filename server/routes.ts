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

// ✨ جديد
import { mountDisputes } from "./routers/disputes";
import { mountDisputeMessages } from "./routers/messages";

const WEBAPP_URL = process.env.WEBAPP_URL!; // required in prod

export async function registerRoutes(app: Express): Promise<Server> {
  // 1) webhook + /api/config
  mountWebhook(app, WEBAPP_URL);

  // 2) bot routes (يُفَعَّل فقط إذا كان TELEGRAM_BOT_TOKEN موجود)
  registerBotRoutes(app);

  // 3) APIs
  mountUsers(app);
  mountListings(app);
  mountChannels(app);
  mountActivities(app);

  // ✨ جديد: نزاعات + رسائل النزاعات
  mountDisputes(app);
  mountDisputeMessages(app);

  mountStats(app);
  mountMisc(app);

  return createServer(app);
}