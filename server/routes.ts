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

const WEBAPP_URL = process.env.WEBAPP_URL ?? "https://your-app.onrender.com";

export async function registerRoutes(app: Express): Promise<Server> {
  // 1) Webhook أولًا
  mountWebhook(app, WEBAPP_URL);

  // 2) مسارات البوت الأخرى فقط (بدون تعريف /webhook/telegram)
  registerBotRoutes(app);

  // 3) APIs
  mountUsers(app);      // users أولًا
  mountListings(app);   // ثم listings
  mountChannels(app);
  mountActivities(app);
  mountStats(app);
  mountMisc(app);       // يجب أن يحتوي /api/config

  const httpServer = createServer(app);
  return httpServer;
}