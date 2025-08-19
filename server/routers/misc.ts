import type { Express } from "express";
import path from "path";
import express from "express";

function baseUrl(req: any) {
  const setUrl = process.env.WEBAPP_URL;
  if (setUrl) return setUrl.replace(/\/+$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

export function mountMisc(app: Express) {
  app.set("trust proxy", 1);

  app.get("/healthz", (_req, res) => {
    res.status(200).json({
      status: "ok",
      ts: new Date().toISOString(),
      uptime: process.uptime(),
      env: process.env.NODE_ENV || "development",
    });
  });

  app.get("/redirect-to-bot", (_req, res) => {
    res.redirect(302, "https://t.me/giftspremarketbot");
  });

  app.post("/setup-webhook", async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" });
      const webhookUrl = `${baseUrl(req)}/webhook/telegram`;
      const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      res.json({ ok: true, webhook_url: webhookUrl, telegram: await r.json() });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to setup webhook" });
    }
  });

  // لا نضيف static هنا لأننا نخدمها من server/vite.ts (serveStatic)
  // وأي fallback للفرونت متكفّل به index.ts بعد serveStatic.
}