import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

if (process.env.NODE_ENV === "production") {
  if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET not set. Using default.");
    process.env.SESSION_SECRET = "telegram-marketplace-default-secret-change-in-production";
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required in production");
    process.exit(1);
  }
}

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const envOrigins =
  (process.env.WEBAPP_URL || process.env.WEBAPP_URLS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

const allowRenderWildcard = process.env.ALLOW_RENDER_ORIGIN === "true";

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (envOrigins.length === 0 || envOrigins.includes(origin)) return cb(null, true);
      if (allowRenderWildcard) {
        try {
          const host = new URL(origin).hostname;
          if (/\.onrender\.com$/.test(host)) return cb(null, true);
        } catch {}
      }
      return cb(null, false);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-setup-key", "x-telegram-bot-api-secret-token"],
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

app.get(["/health", "/healthz"], (_req, res) => res.type("text").send("ok"));

app.use((req, res, next) => {
  const start = Date.now();
  let captured: any;
  const orig = res.json as any;
  (res as any).json = function (body: any, ...args: any[]) { captured = body; return orig.apply(this, [body, ...args]); };
  res.on("finish", () => {
    if (req.path.startsWith("/api") || req.path.startsWith("/webhook")) {
      let line = `${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`;
      if (captured) { try { line += ` :: ${JSON.stringify(captured)}`; } catch {} }
      if (line.length > 160) line = line.slice(0, 159) + "…";
      log(line);
    }
  });
  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("[ERROR]", err);
    res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  app.get("*", (req: Request, res: Response) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/webhook")) {
      return res.status(404).json({ error: "Not Found" });
    }
    return res.sendFile(path.resolve(process.cwd(), "dist/public/index.html"));
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => log(`serving on port ${port}`));
})();