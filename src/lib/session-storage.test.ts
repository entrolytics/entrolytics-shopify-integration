import { execFileSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";
import { Session } from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs against a throwaway Postgres: TEST_DATABASE_URL=postgresql://… pnpm test
const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("Prisma session storage on Postgres", () => {
  let prisma: PrismaClient;
  let storage: PrismaSessionStorage<PrismaClient>;

  beforeAll(() => {
    execFileSync("prisma", ["migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    });
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    storage = new PrismaSessionStorage(prisma);
  });

  afterAll(async () => {
    await prisma?.session.deleteMany({ where: { shop: "storage-test.myshopify.com" } });
    await prisma?.$disconnect();
  });

  it("round-trips an offline session with an expiring access token and its refresh token", async () => {
    const session = new Session({
      accessToken: "shpat_access",
      expires: new Date("2026-11-03T12:00:00.000Z"),
      id: "offline_storage-test.myshopify.com",
      isOnline: false,
      refreshToken: "shprt_refresh",
      refreshTokenExpires: new Date("2027-02-01T12:00:00.000Z"),
      scope: "read_themes,write_script_tags",
      shop: "storage-test.myshopify.com",
      state: "state",
    });

    expect(await storage.storeSession(session)).toBe(true);
    const loaded = await storage.loadSession(session.id);

    expect(loaded?.toObject()).toEqual(session.toObject());
    expect(loaded?.refreshToken).toBe("shprt_refresh");
    expect(loaded?.refreshTokenExpires).toEqual(new Date("2027-02-01T12:00:00.000Z"));
  });
});
