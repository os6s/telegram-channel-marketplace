// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerBotRoutes } from "./telegram-bot";
import { mountWebhook } from "./routers/webhook";
import { mountListings } from "./routers/listings";
import { mountUsers } from "./routers/users";
import { mountChannels } from "./routers/channels";
import { mountActivities } from "./routers/activities";
import { mountStats } from "./routers/stats";
import { mountMisc } from "./routers/misc";

const WEBAPP_URL = process.env.WEBAPP_URL ?? "https://your-app.onrender.com";

export async function registerRoutes(app: Express): Promise<Server> {
  // Webhook أولًا
  mountWebhook(app, WEBAPP_URL);

  // بوت إضافي لو مستخدمه
  registerBotRoutes(app);

  // APIs
  mountListings(app);
  mountUsers(app);
  mountChannels(app);
  mountActivities(app);
  mountStats(app);
  mountMisc(app);

  const httpServer = createServer(app);
  return httpServer;
}