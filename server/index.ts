// server/index.ts
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { fileURLToPath } from "url";

// Routers
import { mountUsers } from "./routers/users.js";
import { mountListings } from "./routers/listings.js";
import { mountPayments } from "./routers/payments.js";
import { registerDisputesRoutes } from "./routers/disputes.js";

// Telegram auth (optional injector)
import { tgOptionalAuth } from "./middleware/tgAuth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!process.env.WEBAPP_URL) throw new Error("WEBAPP_URL is required");
}

const app = express();
app.set("trust proxy", 1);

// Security headers
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CSP
app.use((_, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self' https: data: blob:",
      "script-src 'self' 'unsafe-inline' https://telegram.org https://*.telegram.org",
      "connect-src 'self' https: wss:",
      "img-src 'self' https: data: blob:",
      "style-src 'self' 'unsafe-inline' https:",
      "font-src 'self' https: data:",
      "worker-src 'self' blob:",
      "frame-src 'self' https://t.me https://web.telegram.org https://*.telegram.org",
      "frame-ancestors https://t.me https://web.telegram.org https://*.telegram.org",
    ].join("; ")
  );
  next();
});

app.use(hpp());

// CORS
const allowRenderWildcard = process.env.ALLOW_RENDER_ORIGIN === "true";
const allowed = (process.env.WEBAPP_URL || process.env.WEBAPP_URLS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // Telegram WebView
      if (allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
      if (allowRenderWildcard) {
        try {
          const host = new URL(origin).hostname;
          if (/\.onrender\.com$/.test(host)) return cb(null, true);
        } catch {}
      }
      return cb(null, false);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-setup-key",
      "x-telegram-bot-api-secret-token",
      "x-telegram-init-data",
      "x-telegram-username",
    ],
    credentials: true,
  })
);

// Body limits
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: false, limit: "200kb" }));

// Inject Telegram user if initData present
app.use(tgOptionalAuth);

// Rate limit
app.use("/api", rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
app.use("/webhook/telegram", rateLimit({ windowMs: 60_000, max: 120 }));

app.get(["/health", "/healthz"], (_req, res) => res.type("text").send("ok"));

// API logger
app.use((req, res, next) => {
  const t0 = Date.now();
  const pathUrl = req.path;
  let captured: unknown;
  const orig = res.json as any;
  (res as any).json = function (body: unknown, ...args: unknown[]) {
    captured = body;
    return orig.apply(this, [body, ...args]);
  };
  res.on("finish", () => {
    if (pathUrl.startsWith("/api") || pathUrl.startsWith("/webhook")) {
      let line = `${req.method} ${pathUrl} ${res.statusCode} in ${Date.now() - t0}ms`;
      if (captured) { try { line += ` :: ${JSON.stringify(captured)}`; } catch {} }
      if (line.length > 160) line = line.slice(0, 159) + "…";
      log(line);
    }
  });
  next();
});

(async () => {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || process.env.WEBAPP_URL || "";
  if (!publicBaseUrl) throw new Error("PUBLIC_BASE_URL or WEBAPP_URL must be set");

  // Core routes (auth/session, config, webhook, etc.)
  const server = await registerRoutes(app, { publicBaseUrl });

  // App routers (IDs-based, show usernames via JOIN)
  mountUsers(app);
  mountListings(app);
  mountPayments(app);
  registerDisputesRoutes(app);

  // Error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { status?: number; statusCode?: number; message?: string };
    res.status(e?.status || e?.statusCode || 500).json({ message: e?.message || "Internal Server Error" });
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // SPA fallback
  app.get("*", (req: Request, res: Response) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/webhook")) {
      return res.status(404).json({ error: "Not Found" });
    }
    return res.sendFile(path.resolve(__dirname, "../public/index.html"));
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => log(`serving on port ${port}`));
})();