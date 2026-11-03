import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

// Server settings follow Shopify's React Router app template, for `shopify app dev`.
// The CLI passes the tunnel URL as HOST; move it to SHOPIFY_APP_URL so Vite does not bind to it.
// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL || process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost").hostname;

// Through the tunnel, the browser reaches HMR over wss on 443; Vite listens on FRONTEND_PORT.
const hmrConfig =
  host === "localhost"
    ? { protocol: "ws", host: "localhost", port: 64999, clientPort: 64999 }
    : {
        protocol: "wss",
        host,
        port: Number.parseInt(process.env.FRONTEND_PORT ?? "", 10) || 8002,
        clientPort: 443,
      };

export default defineConfig({
  server: {
    allowedHosts: [host],
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["src/app", "node_modules"],
    },
  },
  // @react-router/dev 8 applies its serve-mode resolve conditions and JSX settings under Vitest,
  // which leaves `react/jsx-dev-runtime` without `jsxDEV`; the test run needs only Vite's JSX.
  plugins: process.env.VITEST ? [] : [reactRouter()],
  resolve: { tsconfigPaths: true },
});
