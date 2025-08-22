// server/routers/misc.ts
import type { Express, Request } from "express";

/* Small helper to compute a public base URL */
function computeBaseUrl(req: Request) {
  const setUrl = process.env.WEBAPP_URL;
  if (setUrl) return setUrl.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.get("host");
  return `${proto}://${host}`;
}

export function mountMisc(app: Express) {
  // behind proxies (Render/Heroku/NGINX)
  app.set("trust proxy", 1);

  // Liveness/health
  app.get("/healthz", (_req, res) => {
    res.status(200).json({
      status: "ok",
      ts: new Date().toISOString(),
      uptime: process.uptime(),
      env: process.env.NODE_ENV || "development",
    });
  });

  // Simple redirect to the bot
  app.get("/redirect-to-bot", (_req, res) => {
    res.redirect(302, "https://t.me/giftspremarketbot");
  });

  // Secure webhook (re)configuration endpoint
  app.post("/setup-webhook", async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" });

      const expectedSecret = process.env.WEBHOOK_SECRET || process.env.SESSION_SECRET;
      const provided = req.get("x-setup-key");
      if (!expectedSecret || provided !== expectedSecret) {
        return res.status(403).json({ error: "forbidden" });
      }

      const url = `${computeBaseUrl(req)}/webhook/telegram`;
      const body = {
        url,
        secret_token: expectedSecret,
        allowed_updates: ["message", "callback_query"] as const,
        drop_pending_updates: false,
      };

      const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const j = await r.json().catch(() => ({}));
      res.json({ ok: true, webhook_url: url, telegram: j });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to setup webhook" });
    }
  });
}