import express, { type Request, Response, NextFunction } from "express";
import cors from "cors"; // ⬅️ أضفنا مكتبة CORS
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Environment variable validation for production deployment
if (process.env.NODE_ENV === 'production') {
  if (!process.env.SESSION_SECRET) {
    console.warn('Warning: SESSION_SECRET environment variable not set. Using default value.');
    process.env.SESSION_SECRET = 'telegram-marketplace-default-secret-change-in-production';
  }
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is required for production');
    process.exit(1);
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('Warning: TELEGRAM_BOT_TOKEN not set. Bot functionality will be disabled.');
  }
}

const app = express();

// ⬅️ إعداد CORS ليسمح بطلبات من الـ WEBAPP_URL
const allowedOrigin = process.env.WEBAPP_URL || "*";
app.use(cors({
  origin: allowedOrigin,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// ⬅️ ميدل وير يرسل API_BASE_URL للـ frontend
app.get("/api/config", (req, res) => {
  res.json({
    API_BASE_URL: process.env.API_BASE_URL || "",
    WEBAPP_URL: process.env.WEBAPP_URL || ""
  });
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();