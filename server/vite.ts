import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import rawViteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const ts = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  console.log(`${ts} [${source}] ${message}`);
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
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    try {
      const tplPath = path.resolve(process.cwd(), "client", "index.html");
      let tpl = await fs.promises.readFile(tplPath, "utf-8");
      tpl = tpl.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
      const html = await vite.transformIndexHtml(req.originalUrl, tpl);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(`Build not found: ${distPath}. Run "vite build".`);
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}