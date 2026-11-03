import type { ActionFunctionArgs } from "react-router";

import { prisma } from "../../lib/db.server";
import { authenticate } from "../../lib/shopify.server";

/**
 * Mandatory compliance webhook, sent 48 hours after a shop uninstalls the app: erase everything
 * stored for the shop, which is its sessions and its Entrolytics settings.
 */
export async function action({ request }: ActionFunctionArgs) {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { shop } }),
    prisma.entrolyticsConfig.deleteMany({ where: { shop } }),
  ]);

  return new Response();
}
