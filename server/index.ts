// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

if (process.env.NODE_ENV === "production") {
  if (!process.env.SESSION_SECRET) {
    console.warn("Warning: SESSION_SECRET not set. Using default.");
    process.env.SESSION_SECRET = "telegram-marketplace-default-secret-change-in-production";
  }
  if (!process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL is required in production");
    process.exit(1);
  }
}

const app = express();
app.set("trust proxy", 1);

// ── Security headers (خفيفة ومتوافقة مع WebApp)
app.use(
  helmet({
    contentSecurityPolicy: false, // CSP عادةً يسبب مشاكل بالـ WebApp
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS مضبوط لعدّة أصول
// WEBAPP_URL قد تكون واحدة أو قائمة مفصولة بفواصل
const envOrigins =
  (process.env.WEBAPP_URL || process.env.WEBAPP_URLS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

const allowRenderWildcard = process.env.ALLOW_RENDER_ORIGIN === "true"; // يسمح *.onrender.com إذا مفعّل

app.use(
  cors({
    origin(origin, cb) {
      // WebView داخل تيليگرام يجي بدون Origin
      if (!origin) return cb(null, true);

      // قبول origins من البيئة
      if (envOrigins.length === 0 || envOrigins.includes(origin)) {
        return cb(null, true);
      }

      // خيار اختياري: قبول نطاقات Render أثناء التطوير
      if (allowRenderWildcard && /\.onrender\.com$/.test(new URL(origin).hostname)) {
        return cb(null, true);
      }

      return cb(null, false);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-setup-key", // لحماية /setup-webhook
      "x-telegram-bot-api-secret-token" // للهيدر السري من تيليگرام للويبهوك
    ],
    credentials: true,
  })
);

// ── Body parsers
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

// ── Healthcheck بسيط (لـ Render)
app.get(["/health", "/healthz", "/"], (_req, res) => {
  res.type("text").send("ok");
});

// ── API logger مختصر
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let captured: any;
  const orig = res.json;
  res.json = function (body, ...args) {
    captured = body;
    // @ts-ignore
    return orig.apply(res, [body, ...args]);
  };
  res.on("finish", () => {
    if (path.startsWith("/api") || path.startsWith("/webhook")) {
      let line = `${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`;
      if (captured) {
        try {
          line += ` :: ${JSON.stringify(captured)}`;
        } catch {}
      }
      if (line.length > 160) line = line.slice(0, 159) + "…";
      log(line);
    }
  });
  next();
});

// ── Bootstrap
(async () => {
  const server = await registerRoutes(app);

  // ── Error handler موحّد
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("[ERROR]", err);
    res.status(status).json({ message });
  });

  // ── Static/Vite
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app); // يخدم dist/public ويعيد index.html
  }

  // ── 404 بعد الستاتيك
  app.use((req: Request, res: Response) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/webhook")) {
      return res.status(404).json({ error: "Not Found" });
    }
    try {
      const path = require("path");
      return res.sendFile(path.resolve("dist/public/index.html"));
    } catch {
      return res.status(404).json({ error: "Not Found" });
    }
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => log(`serving on port ${port}`));
})();
