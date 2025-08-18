// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./drizzle",                 // ← استخدم drizzle فقط
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/dummy",
  },
  strict: true,
  verbose: true,
});