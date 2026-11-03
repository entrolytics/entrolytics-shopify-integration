import { execFileSync } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";
import { Session } from "@shopify/shopify-app-react-router/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "../generated/prisma/client";
import { PrismaSessionStorage } from "./session-storage.server";

// Runs against a throwaway Postgres: TEST_DATABASE_URL=postgresql://… pnpm test
const databaseUrl = process.env.TEST_DATABASE_URL;
const shop = "storage-test.myshopify.com";

const offline = () =>
  new Session({
    accessToken: "shpat_offline",
    expires: new Date("2026-12-01T00:00:00.000Z"),
    id: `offline_${shop}`,
    isOnline: false,
    refreshToken: "shprt_offline",
    refreshTokenExpires: new Date("2027-03-01T00:00:00.000Z"),
    scope: "read_themes,write_script_tags",
    shop,
    state: "state-1",
  });

const online = () =>
  new Session({
    accessToken: "shpua_online",
    expires: new Date("2026-11-05T00:00:00.000Z"),
    id: `${shop}_42`,
    isOnline: true,
    onlineAccessInfo: {
      associated_user: {
        account_owner: true,
        collaborator: false,
        email: "ada@example.com",
        email_verified: true,
        first_name: "Ada",
        id: 42,
        last_name: "Lovelace",
        locale: "en",
      },
      associated_user_scope: "read_themes",
      expires_in: 86400,
    },
    scope: "read_themes",
    shop,
    state: "state-2",
  });

/**
 * The rows @shopify/shopify-app-session-storage-prisma 11.0.1 wrote for offline() and online(),
 * captured from Postgres with pg_dump.
 */
const rowsWrittenByShopifyAdapter = `
INSERT INTO "Session" (id, shop, state, "isOnline", scope, expires, "accessToken", "userId", "firstName", "lastName", email, "accountOwner", locale, collaborator, "emailVerified", "refreshToken", "refreshTokenExpires") VALUES
  ('offline_${shop}', '${shop}', 'state-1', false, 'read_themes,write_script_tags', '2026-12-01 00:00:00', 'shpat_offline', NULL, NULL, NULL, NULL, false, NULL, false, false, 'shprt_offline', '2027-03-01 00:00:00'),
  ('${shop}_42', '${shop}', 'state-2', true, 'read_themes', '2026-11-05 00:00:00', 'shpua_online', 42, 'Ada', 'Lovelace', 'ada@example.com', true, 'en', false, true, NULL, NULL)`;

/** What the Shopify adapter's loadSession returned for those rows (`Session.toObject()`). */
const loadedByShopifyAdapter: Record<string, object> = {
  [`offline_${shop}`]: {
    accessToken: "shpat_offline",
    expires: new Date("2026-12-01T00:00:00.000Z"),
    id: `offline_${shop}`,
    isOnline: false,
    refreshToken: "shprt_offline",
    refreshTokenExpires: new Date("2027-03-01T00:00:00.000Z"),
    scope: "read_themes,write_script_tags",
    shop,
    state: "state-1",
  },
  [`${shop}_42`]: {
    accessToken: "shpua_online",
    expires: new Date("2026-11-05T00:00:00.000Z"),
    id: `${shop}_42`,
    isOnline: true,
    onlineAccessInfo: {
      associated_user: {
        account_owner: true,
        collaborator: false,
        email: "ada@example.com",
        email_verified: true,
        first_name: "Ada",
        id: 42,
        last_name: "Lovelace",
        locale: "en",
      },
    },
    scope: "read_themes",
    shop,
    state: "state-2",
  },
};

describe.skipIf(!databaseUrl)("Prisma session storage on Postgres", () => {
  let prisma: PrismaClient;
  let storage: PrismaSessionStorage;

  beforeAll(() => {
    execFileSync("prisma", ["migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    storage = new PrismaSessionStorage(prisma);
  });

  beforeEach(async () => {
    await prisma.session.deleteMany({ where: { shop } });
  });

  afterAll(async () => {
    await prisma?.session.deleteMany({ where: { shop } });
    await prisma?.$disconnect();
  });

  it("round-trips an offline session with an expiring access token and its refresh token", async () => {
    const session = offline();

    expect(await storage.storeSession(session)).toBe(true);
    const loaded = await storage.loadSession(session.id);

    expect(loaded?.toObject()).toEqual(session.toObject());
    expect(loaded?.refreshToken).toBe("shprt_offline");
    expect(loaded?.refreshTokenExpires).toEqual(new Date("2027-03-01T00:00:00.000Z"));
  });

  it("round-trips an online session with its expiry and associated user", async () => {
    const session = online();

    await storage.storeSession(session);
    const loaded = await storage.loadSession(session.id);

    expect(loaded?.toObject()).toEqual(loadedByShopifyAdapter[session.id]);
    expect(loaded?.onlineAccessInfo?.associated_user.id).toBe(42);
    expect(loaded?.isExpired()).toBe(new Date() > new Date("2026-11-05T00:00:00.000Z"));
  });

  it("writes exactly the rows the Shopify adapter wrote", async () => {
    await storage.storeSession(offline());
    await storage.storeSession(online());
    const written = await prisma.session.findMany({ where: { shop }, orderBy: { id: "asc" } });

    await prisma.session.deleteMany({ where: { shop } });
    await prisma.$executeRawUnsafe(rowsWrittenByShopifyAdapter);
    const expected = await prisma.session.findMany({ where: { shop }, orderBy: { id: "asc" } });

    expect(written).toEqual(expected);
  });

  it("loads rows the Shopify adapter wrote as the same sessions", async () => {
    await prisma.$executeRawUnsafe(rowsWrittenByShopifyAdapter);

    for (const [id, expected] of Object.entries(loadedByShopifyAdapter)) {
      expect((await storage.loadSession(id))?.toObject()).toEqual(expected);
    }
  });

  it("updates a stored session in place", async () => {
    const session = offline();
    await storage.storeSession(session);
    session.accessToken = "shpat_rotated";

    await storage.storeSession(session);

    expect((await storage.loadSession(session.id))?.accessToken).toBe("shpat_rotated");
    expect(await prisma.session.count({ where: { shop } })).toBe(1);
  });

  it("returns undefined for an unknown session", async () => {
    expect(await storage.loadSession("offline_unknown.myshopify.com")).toBeUndefined();
  });

  it("deletes one session, and succeeds when it is already gone", async () => {
    await storage.storeSession(offline());
    await storage.storeSession(online());

    expect(await storage.deleteSession(`offline_${shop}`)).toBe(true);
    expect(await storage.deleteSession(`offline_${shop}`)).toBe(true);

    expect(await storage.loadSession(`offline_${shop}`)).toBeUndefined();
    expect(await storage.loadSession(`${shop}_42`)).toBeDefined();
  });

  it("deletes several sessions by id", async () => {
    await storage.storeSession(offline());
    await storage.storeSession(online());

    expect(await storage.deleteSessions([`offline_${shop}`, `${shop}_42`])).toBe(true);

    expect(await prisma.session.count({ where: { shop } })).toBe(0);
  });

  it("finds a shop's sessions, latest expiry first, and no others", async () => {
    await storage.storeSession(online());
    await storage.storeSession(offline());
    await storage.storeSession(
      new Session({
        id: "offline_other.myshopify.com",
        isOnline: false,
        shop: "other.myshopify.com",
        state: "s",
      }),
    );

    const sessions = await storage.findSessionsByShop(shop);

    expect(sessions.map((session) => session.id)).toEqual([`offline_${shop}`, `${shop}_42`]);
    await storage.deleteSession("offline_other.myshopify.com");
  });
});
