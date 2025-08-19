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

const WEBAPP_URL = process.env.WEBAPP_URL!; // required in prod

export async function registerRoutes(app: Express): Promise<Server> {
  // webhook + /api/config
  mountWebhook(app, WEBAPP_URL);

  // bot routes only if token exists
  registerBotRoutes(app);

  // APIs
  mountUsers(app);
  mountListings(app);
  mountChannels(app);
  mountActivities(app);
  mountStats(app);
  mountMisc(app);

  return createServer(app);
}