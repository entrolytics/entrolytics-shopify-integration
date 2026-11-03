import { createHmac } from "node:crypto";

import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SHOPIFY_API_KEY = "api-key";
  process.env.SHOPIFY_API_SECRET = "api-secret";
  process.env.SHOPIFY_APP_URL = "https://app.example.com";
});

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (operations: unknown[]) => operations),
  entrolyticsConfig: { deleteMany: vi.fn((args: unknown) => ({ deleteConfig: args })) },
  session: {
    count: vi.fn(async () => 0),
    deleteMany: vi.fn((args: unknown) => ({ deleteSessions: args })),
    findUnique: vi.fn(async () => null),
  },
}));

// The real shopifyApp config verifies the HMACs; only the database is stubbed.
vi.mock("../lib/db.server", () => ({ prisma }));

const routes = {
  "customers/data_request": await import("./routes/webhooks.customers.data_request"),
  "customers/redact": await import("./routes/webhooks.customers.redact"),
  "shop/redact": await import("./routes/webhooks.shop.redact"),
};

const shop = "example.myshopify.com";

function deliver(topic: keyof typeof routes, { secret = "api-secret" } = {}) {
  const body = JSON.stringify({ shop_domain: shop, shop_id: 1 });
  const request = new Request(`https://app.example.com/webhooks/${topic}`, {
    body,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-API-Version": "2026-07",
      "X-Shopify-Hmac-Sha256": createHmac("sha256", secret).update(body).digest("base64"),
      "X-Shopify-Shop-Domain": shop,
      "X-Shopify-Topic": topic,
      "X-Shopify-Webhook-Id": "webhook-1",
    },
    method: "POST",
  });
  return routes[topic]
    .action({
      context: new RouterContextProvider(),
      params: {},
      pattern: "",
      request,
      url: new URL(request.url),
    })
    .catch((thrown: unknown) => thrown);
}

beforeEach(() => vi.clearAllMocks());

describe("compliance webhooks", () => {
  it("shop/redact deletes the shop's sessions and settings together", async () => {
    const response = (await deliver("shop/redact")) as Response;

    expect(response.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledWith([
      { deleteSessions: { where: { shop } } },
      { deleteConfig: { where: { shop } } },
    ]);
  });

  it.each(["customers/data_request", "customers/redact"] as const)(
    "%s is acknowledged without touching the database, which holds no customer data",
    async (topic) => {
      const response = (await deliver(topic)) as Response;

      expect(response.status).toBe(200);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
      expect(prisma.entrolyticsConfig.deleteMany).not.toHaveBeenCalled();
    },
  );

  it.each(Object.keys(routes) as (keyof typeof routes)[])(
    "%s rejects a delivery with an invalid HMAC with 401",
    async (topic) => {
      const response = (await deliver(topic, { secret: "wrong" })) as Response;

      expect(response.status).toBe(401);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
});
