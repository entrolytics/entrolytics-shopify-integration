import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateAdmin = vi.fn();
const getShopConfig = vi.fn();
const saveShopConfig = vi.fn();
const deleteShopConfig = vi.fn();
const installScriptTag = vi.fn();
const removeScriptTag = vi.fn();

vi.mock("../lib/shopify.server", () => ({ authenticate: { admin: authenticateAdmin } }));
vi.mock("../lib/entrolytics.server", () => ({
  deleteShopConfig,
  getShopConfig,
  installScriptTag,
  removeScriptTag,
  saveShopConfig,
}));

const { action, headers: indexHeaders, loader: indexLoader } = await import("./routes/app._index");
const { headers: appHeaders, loader: appLoader } = await import("./routes/app");
const { headers: authHeaders, loader: authLoader } = await import("./routes/auth.$");

const shop = "example.myshopify.com";
const admin = { graphql: vi.fn() };
const websiteId = "91800f1f-6a5f-44b9-b063-d5577b51c6aa";
/** Loader/action arguments the way React Router passes them for `request`. */
function args(request: Request) {
  return {
    context: new RouterContextProvider(),
    params: {},
    pattern: "",
    request,
    url: new URL(request.url),
  };
}

function post(fields: Record<string, string>) {
  const request = new Request("https://app.example.com/app?index", {
    body: new URLSearchParams(fields),
    method: "POST",
  });
  return action(args(request));
}

/** A `data()` result carries its payload and status in `data` and `init`. */
function unwrap(result: unknown) {
  if (result && typeof result === "object" && "init" in result && "data" in result) {
    const { data, init } = result as { data: unknown; init: ResponseInit | null };
    return { body: data, status: init?.status ?? 200 };
  }
  return { body: result, status: 200 };
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticateAdmin.mockResolvedValue({ admin, session: { shop } });
});

describe("app._index loader", () => {
  it("returns the stored configuration for the authenticated shop", async () => {
    const config = { clientKey: "key", websiteId, host: "https://self.example", autoTrack: false };
    getShopConfig.mockResolvedValue(config);

    const result = await indexLoader(args(new Request("https://app.example.com/app")));

    expect(getShopConfig).toHaveBeenCalledWith(shop);
    expect(result).toEqual({ shop, config });
  });

  it("falls back to empty defaults when the shop has no configuration", async () => {
    getShopConfig.mockResolvedValue(null);

    const result = await indexLoader(args(new Request("https://app.example.com/app")));

    expect(result.config).toMatchObject({ clientKey: "", websiteId: "", autoTrack: true });
  });
});

describe("app._index action", () => {
  const valid = {
    action: "save",
    autoTrack: "true",
    clientKey: "public-key",
    host: "https://api.entrolytics.click",
    respectDnt: "false",
    trackRevenue: "true",
    websiteId,
  };

  it("installs the script tag and saves the configuration", async () => {
    installScriptTag.mockResolvedValue({ success: true, scriptTagId: "gid://1", created: true });

    const result = unwrap(await post(valid));

    expect(result).toEqual({
      body: { success: true, message: "Analytics enabled successfully!" },
      status: 200,
    });
    expect(installScriptTag).toHaveBeenCalledWith(admin, shop);
    expect(saveShopConfig).toHaveBeenCalledWith(shop, {
      autoTrack: true,
      clientKey: "public-key",
      host: "https://api.entrolytics.click",
      respectDnt: false,
      scriptTagId: "gid://1",
      trackRevenue: true,
      websiteId,
    });
  });

  it("rejects an invalid configuration with 400 before touching the store", async () => {
    const result = unwrap(await post({ ...valid, websiteId: "not-a-uuid" }));

    expect(result.status).toBe(400);
    expect(result.body).toHaveProperty("error");
    expect(installScriptTag).not.toHaveBeenCalled();
    expect(saveShopConfig).not.toHaveBeenCalled();
  });

  it("returns 400 with the Shopify error when the script tag cannot be created", async () => {
    installScriptTag.mockResolvedValue({ success: false, error: "Access denied" });

    expect(unwrap(await post(valid))).toEqual({ body: { error: "Access denied" }, status: 400 });
    expect(saveShopConfig).not.toHaveBeenCalled();
  });

  it("removes a newly created script tag when saving the configuration fails", async () => {
    installScriptTag.mockResolvedValue({ success: true, scriptTagId: "gid://1", created: true });
    saveShopConfig.mockRejectedValue(new Error("database down"));

    await expect(post(valid)).rejects.toThrow("database down");
    expect(removeScriptTag).toHaveBeenCalledWith(admin, shop, "gid://1");
  });

  it("disables analytics by removing the script tag and the configuration", async () => {
    getShopConfig.mockResolvedValue({ scriptTagId: "gid://1" });
    removeScriptTag.mockResolvedValue({ success: true });

    expect(unwrap(await post({ action: "disable" }))).toEqual({
      body: { success: true, message: "Analytics disabled" },
      status: 200,
    });
    expect(removeScriptTag).toHaveBeenCalledWith(admin, shop, "gid://1");
    expect(deleteShopConfig).toHaveBeenCalledWith(shop);
  });

  it("keeps the configuration when the script tag cannot be removed", async () => {
    getShopConfig.mockResolvedValue({ scriptTagId: "gid://1" });
    removeScriptTag.mockResolvedValue({ success: false, error: "Not found" });

    expect(unwrap(await post({ action: "disable" }))).toEqual({
      body: { error: "Not found" },
      status: 400,
    });
    expect(deleteShopConfig).not.toHaveBeenCalled();
  });

  it("rejects unknown actions with 400", async () => {
    expect(unwrap(await post({ action: "nope" }))).toEqual({
      body: { error: "Unknown action" },
      status: 400,
    });
  });
});

describe("app layout loader", () => {
  it("authenticates and returns the API key for App Bridge", async () => {
    vi.stubEnv("SHOPIFY_API_KEY", "api-key");

    const result = await appLoader(args(new Request("https://app.example.com/app")));

    expect(authenticateAdmin).toHaveBeenCalled();
    expect(result).toEqual({ apiKey: "api-key" });
    vi.unstubAllEnvs();
  });

  it("fails with 500 when SHOPIFY_API_KEY is missing", async () => {
    vi.stubEnv("SHOPIFY_API_KEY", "");

    const thrown = await appLoader(args(new Request("https://app.example.com/app"))).catch(
      (error: unknown) => error,
    );

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(500);
    vi.unstubAllEnvs();
  });
});

describe("auth splat loader", () => {
  it("delegates to authenticate.admin", async () => {
    const request = new Request("https://app.example.com/auth/session-token");

    expect(await authLoader(args(request))).toBeNull();
    expect(authenticateAdmin).toHaveBeenCalledWith(request);
  });
});

describe("headers exports", () => {
  it.each([
    ["app._index", indexHeaders],
    ["app", appHeaders],
    ["auth.$", authHeaders],
  ])(
    "%s forwards Shopify's error headers so reauthorization reaches App Bridge",
    (_name, headers) => {
      const errorHeaders = new Headers({ "X-Shopify-API-Request-Failure-Reauthorize": "1" });
      const args = {
        actionHeaders: new Headers(),
        errorHeaders,
        loaderHeaders: new Headers({ "X-Loader": "1" }),
        parentHeaders: new Headers(),
      };

      expect(headers(args)).toBe(errorHeaders);
      expect(new Headers(headers({ ...args, errorHeaders: undefined })).get("X-Loader")).toBe("1");
    },
  );
});
