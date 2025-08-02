import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",           // مجلد تخزين المايجريشنات
  schema: "./shared/schema.ts",  // مكان سكيمات الجداول
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});