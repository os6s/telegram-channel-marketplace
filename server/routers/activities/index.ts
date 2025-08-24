import type { Express } from "express";
import { listActivities } from "./handlers/list.js";
import { getActivity } from "./handlers/getOne.js";
import { createActivity } from "./handlers/create.js";
import { confirmBuyer } from "./handlers/confirmBuyer.js";
import { confirmSeller } from "./handlers/confirmSeller.js";
import { updateActivity } from "./handlers/update.js";

export function mountActivities(app: Express) {
  app.get("/api/activities", listActivities);
  app.get("/api/activities/:id", getActivity);
  app.post("/api/activities", createActivity);
  app.post("/api/activities/confirm/buyer", confirmBuyer);
  app.post("/api/activities/confirm/seller", confirmSeller);
  app.patch("/api/activities/:id", updateActivity);
}