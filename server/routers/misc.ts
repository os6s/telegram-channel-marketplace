// server/routers/misc.ts
import type { Express, Request } from "express";

/* Compute a public base URL */
function computeBaseUrl(req: Request) {
  const setUrl = process.env.WEBAPP_URL;
  if (setUrl) return setUrl.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.get("host");
  return `${proto}://${host}`;
}

export function mountMisc(app: Express) {
  // Simple redirect to the bot (configurable)
  app.get("/redirect-to-bot", (_req, res) => {
    const botUser = process.env.BOT_USERNAME || "giftspremarketbot";
    res.redirect(302, `https://t.me/${botUser}`);
  });

  // Secure webhook (re)configuration endpoint
  app.post("/setup-webhook", async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" });

      const expectedSecret = process.env.WEBHOOK_SECRET || process.env.SESSION_SECRET || "";
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