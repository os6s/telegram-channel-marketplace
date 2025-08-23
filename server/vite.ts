// server/vite.ts
import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import rawViteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = { middlewareMode: true, hmr: { server }, allowedHosts: true as const };

  const baseConfig =
    typeof rawViteConfig === "function"
      ? (rawViteConfig as any)({ mode: "development", command: "serve" })
      : rawViteConfig;

  const vite = await createViteServer({
    ...(baseConfig || {}),
    configFile: false,
    customLogger: {
      ...viteLogger,
      // لا تُنهِ العملية في التطوير—اطبع الخطأ فقط
      error: (msg, options) => {
        viteLogger.error(msg, options);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    try {
      const tplPath = path.resolve(process.cwd(), "client", "index.html");
      if (!fs.existsSync(tplPath)) {
        throw new Error(`client/index.html not found at ${tplPath}`);
      }
      let template = await fs.promises.readFile(tplPath, "utf-8");
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist/public");
  if (!fs.existsSync(distPath)) {
    throw new Error(`Build output not found: ${distPath}. Run client build first.`);
  }

  // كاش للملفات الثابتة (يمكن تعديل maxAge حسب الحاجة)
  app.use(
    express.static(distPath, {
      setHeaders(res, filePath) {
        // لا نُخزّن index.html بشدة
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

  app.use("*", (_req, res) => res.sendFile(path.resolve(distPath, "index.html")));
}