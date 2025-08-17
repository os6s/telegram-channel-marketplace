// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
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

/* ---------- CORS ---------- */
const allowedOrigin = process.env.WEBAPP_URL || "";
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);            // تطبيقات تيليجرام غالباً بدون Origin
      if (!allowedOrigin) return cb(null, true);     // مفتوح إذا ما محدد
      return cb(null, origin === allowedOrigin);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
// preflight
app.options("*", cors());

/* ---------- Parsers ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ---------- API logger ---------- */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let captured: any;
  const orig = res.json;
  res.json = function (body, ...args) {
    captured = body;
    return orig.apply(res, [body, ...args]);
  };
  res.on("finish", () => {
    if (path.startsWith("/api")) {
      let line = `${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`;
      if (captured) line += ` :: ${JSON.stringify(captured)}`;
      if (line.length > 80) line = line.slice(0, 79) + "…";
      log(line);
    }
  });
  next();
});

(async () => {
  /* ---------- Register routes (webhook + APIs) ---------- */
  const server = await registerRoutes(app);

  /* ---------- 404 handler (بعد كل المسارات) ---------- */
  app.use((req: Request, res: Response) => {
    // اسمح للفرونت يأخذ الراوتس من Vite/الستاتك، ولا ترد 404 لطلبات SPA
    if (
      req.method === "GET" &&
      !req.path.startsWith("/api") &&
      !req.path.startsWith("/webhook") &&
      !req.path.includes(".")
    ) {
      // نمرر للـ static/Vite (تم ضبطه تحت)
      return res.status(200).end();
    }
    return res.status(404).json({ error: "Not Found" });
  });

  /* ---------- Error handler ---------- */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("[ERROR]", err);
    res.status(status).json({ message });
  });

  /* ---------- Static/Vite ---------- */
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  /* ---------- Start ---------- */
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => log(`serving on port ${port}`));

  /* ---------- Graceful shutdown ---------- */
  const shutdown = async () => {
    try {
      log("Shutting down…");
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 3000);
    } catch {
      process.exit(1);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();