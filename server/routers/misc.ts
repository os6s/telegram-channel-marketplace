// server/routers/misc.ts
import type { Express } from "express";

export function mountMisc(app: Express) {
  // تعطيل ريديركت تلقائي مؤقتًا
  app.use((req, res, next) => {
    if (
      req.path.startsWith("/webhook/") ||
      req.path.startsWith("/api/") ||
      req.path.startsWith("/src/") ||
      req.path.includes(".")
    ) {
      return next();
    }
    if (req.path === "/" || req.path === "/index.html") {
      console.log("Allowing all requests - redirect middleware disabled for testing");
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
    });
  });

  app.get("/redirect-to-bot", (_req, res) => {
    res.redirect(301, "https://t.me/giftspremarketbot");
  });

  app.post("/setup-webhook", async (req, res) => {
    try {
      const webhookUrl = `${req.protocol}://${req.get("host")}/webhook/telegram`;
      res.json({ success: true, webhook_url: webhookUrl, message: "Webhook URL configured" });
    } catch (error) {
      res.status(500).json({ error: "Failed to setup webhook" });
    }
  });

  app.get("/setup-webhook", async (req, res) => {
    try {
      const webhookUrl = `${req.protocol}://${req.get("host")}/webhook/telegram`;
      res.json({ success: true, webhook_url: webhookUrl, message: "Webhook URL configured" });
    } catch (error) {
      res.status(500).json({ error: "Failed to setup webhook" });
    }
  });
}