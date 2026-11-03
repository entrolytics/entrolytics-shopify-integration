import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../../lib/shopify.server";

/**
 * Mandatory compliance webhook. The app stores no customer data (only the shop's sessions and its
 * Entrolytics settings), so there is nothing to report; the verified delivery is acknowledged with 200.
 */
export async function action({ request }: ActionFunctionArgs) {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  return new Response();
}
