import { describe, expect, it } from "vitest";

import { DEFAULT_ENTROLYTICS_HOST, entrolyticsConfigSchema } from "./entrolytics-config";

describe("Shopify Entrolytics configuration", () => {
  it("normalizes required values and supplies safe defaults", () => {
    const config = entrolyticsConfigSchema.parse({
      clientKey: "  public-key  ",
      websiteId: "91800f1f-6a5f-44b9-b063-d5577b51c6aa",
    });

    expect(config).toEqual({
      autoTrack: true,
      clientKey: "public-key",
      host: DEFAULT_ENTROLYTICS_HOST,
      respectDnt: false,
      trackRevenue: true,
      websiteId: "91800f1f-6a5f-44b9-b063-d5577b51c6aa",
    });
  });

  it("rejects invalid website identifiers and hosts", () => {
    expect(() =>
      entrolyticsConfigSchema.parse({ clientKey: "key", host: "not-a-url", websiteId: "no" }),
    ).toThrow();
  });
});
