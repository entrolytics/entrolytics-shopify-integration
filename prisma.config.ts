import { existsSync } from "node:fs";

import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads .env itself; the Shopify CLI and deploy targets set DATABASE_URL directly.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Not env("DATABASE_URL"): that throws on load, and `prisma generate` must run without a database.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
