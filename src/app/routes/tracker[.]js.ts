import type { LoaderFunctionArgs } from "@remix-run/node";

import { getShopConfig } from "../../lib/entrolytics.server";

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export async function loader({ request }: LoaderFunctionArgs) {
  const shop = new URL(request.url).searchParams.get("shop")?.toLowerCase();
  if (!shop || !SHOP_DOMAIN_PATTERN.test(shop)) {
    return new Response("Invalid shop", { status: 400 });
  }

  const config = await getShopConfig(shop);
  if (!config) return new Response("Configuration not found", { status: 404 });

  const serialized = JSON.stringify({
    autoTrack: config.autoTrack,
    clientKey: config.clientKey,
    host: config.host.replace(/\/$/, ""),
    trackRevenue: config.trackRevenue,
    websiteId: config.websiteId,
  }).replaceAll("<", "\\u003c");

  const script = `(() => {
  const config = ${serialized};
  const trackerScript = document.createElement('script');
  trackerScript.defer = true;
  trackerScript.src = config.host + '/script.js';
  trackerScript.dataset.websiteId = config.websiteId;
  trackerScript.dataset.clientKey = config.clientKey;
  trackerScript.dataset.apiUrl = config.host;
  trackerScript.dataset.autoTrack = String(config.autoTrack);
  trackerScript.addEventListener('load', () => {
    if (!config.trackRevenue || !window.entrolytics) return;
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[name="add"], .add-to-cart, [data-add-to-cart]')) {
        window.entrolytics.track('add_to_cart');
      }
    });
    const checkout = window.Shopify && window.Shopify.checkout;
    if (!checkout || !checkout.order_id) return;
    const marker = 'entrolytics.shopify.purchase.' + checkout.order_id;
    if (sessionStorage.getItem(marker)) return;
    window.entrolytics.track('purchase', {
      currency: checkout.currency,
      items: Array.isArray(checkout.line_items) ? checkout.line_items.length : 0,
      order_id: checkout.order_id,
      revenue: Number(checkout.total_price) / 100,
    });
    sessionStorage.setItem(marker, 'sent');
  });
  document.head.appendChild(trackerScript);
})();`;

  return new Response(script, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/javascript; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
