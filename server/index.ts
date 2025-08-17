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

// CORS
const allowed = process.env.WEBAPP_URL || "";
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (!allowed) return cb(null, true);
    cb(null, origin === allowed);
  },
  methods: ["GET","POST","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API logger
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let captured: any;
  const orig = res.json;
  res.json = function (body, ...args) { captured = body; return orig.apply(res, [body, ...args]); };
  res.on("finish", () => {
    if (path.startsWith("/api")) {
      let line = `${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`;
      if (captured) line += ` :: ${JSON.stringify(captured)}`;
      if (line.length > 80) line = line.slice(0,79) + "…";
      log(line);
    }
  });
  next();
});

(async () => {
  const server = await registerRoutes(app);

  // error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    console.error(err);
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => log(`serving on port ${port}`));
})();