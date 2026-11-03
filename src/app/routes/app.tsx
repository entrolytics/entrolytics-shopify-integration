import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json" with { type: "json" };
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../../lib/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) throw new Response("SHOPIFY_API_KEY is required", { status: 500 });
  return { apiKey };
}

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();
  return (
    <AppProvider apiKey={apiKey}>
      <PolarisAppProvider i18n={polarisTranslations}>
        <Outlet />
      </PolarisAppProvider>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
