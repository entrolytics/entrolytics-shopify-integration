import type { EntryContext } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SHOPIFY_API_KEY = "api-key";
  process.env.SHOPIFY_API_SECRET = "api-secret";
  process.env.SHOPIFY_APP_URL = "https://app.example.com";
});

// The real shopifyApp config runs; only the database and the route tree are stubbed.
vi.mock("../lib/db.server", () => ({ prisma: { session: { count: vi.fn(async () => 0) } } }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  ServerRouter: () => <p>document</p>,
}));

const { default: handleRequest } = await import("./entry.server");

function render(url: string, userAgent = "Mozilla/5.0") {
  return handleRequest(
    new Request(url, { headers: { "user-agent": userAgent } }),
    200,
    new Headers(),
    {} as EntryContext,
  );
}

describe("entry.server", () => {
  it("lets only the shop's admin frame document responses", async () => {
    const response = await render("https://app.example.com/app?shop=example.myshopify.com");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "frame-ancestors https://example.myshopify.com https://admin.shopify.com https://*.spin.dev https://admin.myshopify.io https://admin.shop.dev;",
    );
    expect(response.headers.get("Link")).toContain("app-bridge.js");
    expect(await response.text()).toContain("<p>document</p>");
  });

  it("does not put an unsanitized shop into the header", async () => {
    const response = await render("https://app.example.com/app?shop=evil.com");

    expect(response.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("waits for the full document for bots", async () => {
    const response = await render(
      "https://app.example.com/app?shop=example.myshopify.com",
      "Googlebot/2.1",
    );

    expect(await response.text()).toContain("<p>document</p>");
  });
});
