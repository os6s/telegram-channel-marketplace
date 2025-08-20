// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)));

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: false,            // لا تفرّغ dist بالكامل أثناء تعدد المخرجات
    sourcemap: true,
    commonjsOptions: { include: [/node_modules/] },
  },
  optimizeDeps: { include: ["@tonconnect/ui-react"] },
  server: {
    fs: {
      strict: true,
      // اسمح بقراءة مجلد الجذر حتى تعمل alias مثل @shared خارج client/
      allow: [__dirname],
      deny: ["**/.*"],
    },
  },
  base: "/",                       // أساس آمن للنشر على Render
});