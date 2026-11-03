import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/shopify.server", () => ({ authenticate: { admin: vi.fn() } }));
vi.mock("../lib/entrolytics.server", () => ({}));

const { default: Index } = await import("./routes/app._index");

const emptyConfig = {
  autoTrack: true,
  clientKey: "",
  host: "https://api.entrolytics.click",
  respectDnt: false,
  trackRevenue: true,
  websiteId: "",
};

function render(config: typeof emptyConfig) {
  const Stub = createRoutesStub([{ Component: Index, id: "index", path: "/" }]);
  return renderToString(
    <Stub hydrationData={{ loaderData: { index: { config, shop: "example.myshopify.com" } } }} />,
  );
}

describe("app._index view", () => {
  it("renders the settings form with Polaris web components", () => {
    const html = render(emptyConfig);

    expect(html).toContain('<s-page heading="Entrolytics Analytics">');
    expect(html).toContain('<s-section heading="Connect Your Store to Entrolytics">');
    for (const label of ["Website ID", "Client key", "Host URL"]) {
      expect(html).toContain(`label="${label}"`);
    }
    expect(html).toContain('value="https://api.entrolytics.click"');
    expect(html).toMatch(
      /<s-link href="https:\/\/entrolytics\.\w+" target="_blank">Entrolytics dashboard<\/s-link>/,
    );
    expect(html.match(/<s-checkbox [^>]*checked=""/g)).toHaveLength(2);
    expect(html).toContain('<s-section slot="aside" heading="Getting Started">');
    expect(html).toContain('<s-banner tone="info">');
    expect(html).not.toContain("Polaris-");
  });

  it("offers only enabling, disabled until both identifiers are set, for an unconfigured shop", () => {
    const html = render(emptyConfig);

    expect(html).toMatch(/<s-button variant="primary" disabled="">Enable Analytics<\/s-button>/);
    expect(html).not.toContain("Disable Analytics");
    expect(html).not.toContain("loading=");
  });

  it("offers updating and disabling for a configured shop", () => {
    const html = render({
      ...emptyConfig,
      clientKey: "public-key",
      websiteId: "91800f1f-6a5f-44b9-b063-d5577b51c6aa",
    });

    expect(html).toMatch(/<s-button variant="primary">Update Settings<\/s-button>/);
    expect(html).toMatch(
      /<s-button variant="tertiary" tone="critical">Disable Analytics<\/s-button>/,
    );
  });
});
