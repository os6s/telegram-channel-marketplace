import type { Express } from "express";
import { requireTelegramUser } from "../../middleware/tgAuth.js";
import { createListing } from "./handlers/create.js";
import { listListings } from "./handlers/list.js";
import { getListing } from "./handlers/getOne.js";
import { removeListing } from "./handlers/remove.js";

export function mountListings(app: Express) {
  app.post("/api/listings", requireTelegramUser, createListing);
  app.get("/api/listings", listListings);
  app.get("/api/listings/:id", getListing);
  app.delete("/api/listings/:id", requireTelegramUser, removeListing);
}