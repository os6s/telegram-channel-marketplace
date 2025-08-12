// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)));

export default defineConfig(({ mode }) => {
  const isReplit = !!process.env.REPL_ID && mode !== "production";

  const plugins = [react()];

  // فعّل إضافات Replit فقط بالبيئة المناسبة وبدون await توب-لفل
  if (isReplit) {
    try {
      // dynamic require-like without top-level await
      import("@replit/vite-plugin-runtime-error-modal").then((m) =>
        plugins.push(m.default()),
      );
      import("@replit/vite-plugin-cartographer").then((m) =>
        plugins.push(m.cartographer()),
      );
    } catch {
      // تجاهل لو غير متوفرة
    }
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"),
      },
    },
    root: path.resolve(__dirname, "client"),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        onwarn(w, warn) {
          console.warn("[rollup warn]", w.message, w.loc || w.id || "");
          warn(w);
        },
      },
      commonjsOptions: { include: [/node_modules/] },
    },
    optimizeDeps: {
      include: ["@tonconnect/ui-react"],
    },
    server: {
      fs: { strict: true, deny: ["**/.*"] },
    },
  };
});