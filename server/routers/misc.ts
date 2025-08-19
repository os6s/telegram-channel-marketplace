// server/routers/misc.ts
import type { Express } from "express";
import path from "path";
import express from "express";

function baseUrl(req: any) {
  return process.env.WEBAPP_URL?.replace(/\/+$/, "") || `${req.protocol}://${req.get("host")}`;
}

export function mountMisc(app: Express) {
  app.set("trust proxy", 1);

  // Health check
  app.get("/healthz", (_req, res) => {
    res.status(200).json({
      status: "ok",
      ts: new Date().toISOString(),
      uptime: process.uptime(),
      env: process.env.NODE_ENV || "development",
    });
  });

  // Redirect للبوت
  app.get("/redirect-to-bot", (_req, res) => {
    res.redirect(302, "https://t.me/giftspremarketbot");
  });

  // Setup webhook
  app.post("/setup-webhook", async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" });
      const webhookUrl = `${baseUrl(req)}/webhook/telegram`;
      const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const data = await r.json();
      res.json({ ok: true, webhook_url: webhookUrl, telegram: data });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to setup webhook" });
    }
  });

  // static frontend serving
  const clientDist = path.join(process.cwd(), "dist", "client");
  app.use(express.static(clientDist));

  // fallback → يخلي React/Vue Router يشتغل
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/webhook/")) {
      return res.status(404).end();
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}