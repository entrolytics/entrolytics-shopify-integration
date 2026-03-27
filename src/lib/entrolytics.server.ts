import { prisma } from "./db.server";

const DEFAULT_HOST = "https://ng.entrolytics.click";

export interface EntrolyticsConfig {
	websiteId: string;
	host?: string;
	autoTrack?: boolean;
	trackRevenue?: boolean;
	respectDnt?: boolean;
	useEdgeRuntime?: boolean;
}

/**
 * Get Entrolytics configuration for a shop
 */
export async function getShopConfig(
	shop: string,
): Promise<EntrolyticsConfig | null> {
	const config = await prisma.entrolyticsConfig.findUnique({
		where: { shop },
	});

	if (!config) return null;

	return {
		websiteId: config.websiteId,
		host: config.host || DEFAULT_HOST,
		autoTrack: config.autoTrack,
		trackRevenue: config.trackRevenue,
		respectDnt: config.respectDnt,
	};
}

/**
 * Save Entrolytics configuration for a shop
 */
export async function saveShopConfig(
	shop: string,
	config: EntrolyticsConfig,
): Promise<void> {
	await prisma.entrolyticsConfig.upsert({
		where: { shop },
		update: {
			websiteId: config.websiteId,
			host: config.host || DEFAULT_HOST,
			autoTrack: config.autoTrack ?? true,
			trackRevenue: config.trackRevenue ?? true,
			respectDnt: config.respectDnt ?? false,
			updatedAt: new Date(),
		},
		create: {
			shop,
			websiteId: config.websiteId,
			host: config.host || DEFAULT_HOST,
			autoTrack: config.autoTrack ?? true,
			trackRevenue: config.trackRevenue ?? true,
			respectDnt: config.respectDnt ?? false,
		},
	});
}

/**
 * Delete Entrolytics configuration for a shop
 */
export async function deleteShopConfig(shop: string): Promise<void> {
	await prisma.entrolyticsConfig
		.delete({
			where: { shop },
		})
		.catch(() => {
			// Ignore if doesn't exist
		});
}

/**
 * Generate the Entrolytics script tag content
 */
export function generateScriptTag(config: EntrolyticsConfig): string {
	const host = (config.host || DEFAULT_HOST).replace(/\/$/, "");
	const useEdgeRuntime = config.useEdgeRuntime ?? true; // Default to edge
	const scriptPath = useEdgeRuntime ? "/script-edge.js" : "/script.js";

	const attrs = [
		`src="${host}${scriptPath}"`,
		`data-website-id="${config.websiteId}"`,
	];

	if (!config.autoTrack) {
		attrs.push('data-auto-track="false"');
	}

	if (config.respectDnt) {
		attrs.push('data-do-not-track="true"');
	}

	// E-commerce tracking script
	let script = `<script ${attrs.join(" ")} defer></script>`;

	// Add revenue tracking if enabled
	if (config.trackRevenue) {
		script += `
<script>
(function() {
  // Wait for Entrolytics to load
  function waitForEntrolytics(callback) {
    if (window.entrolytics) {
      callback();
    } else {
      setTimeout(function() { waitForEntrolytics(callback); }, 100);
    }
  }

  // Track Shopify events
  waitForEntrolytics(function() {
    // Track add to cart
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[name="add"], .add-to-cart, [data-add-to-cart]');
      if (btn) {
        window.entrolytics.track('add_to_cart');
      }
    });

    // Track checkout (Shopify fires this on thank you page)
    if (window.Shopify && window.Shopify.checkout) {
      var checkout = window.Shopify.checkout;
      window.entrolytics.track('purchase', {
        revenue: parseFloat(checkout.total_price) / 100,
        currency: checkout.currency,
        order_id: checkout.order_id,
        items: checkout.line_items ? checkout.line_items.length : 0
      });
    }
  });
})();
</script>`;
	}

	return script;
}

/**
 * Install script tag via Shopify API
 */
export async function installScriptTag(
	admin: { graphql: (query: string) => Promise<Response> },
	config: EntrolyticsConfig,
): Promise<{ success: boolean; error?: string }> {
	const host = (config.host || DEFAULT_HOST).replace(/\/$/, "");
	const useEdgeRuntime = config.useEdgeRuntime ?? true; // Default to edge
	const scriptPath = useEdgeRuntime ? "/script-edge.js" : "/script.js";
	const scriptUrl = `${host}${scriptPath}`;

	const response = await admin.graphql(`
    mutation scriptTagCreate {
      scriptTagCreate(input: {
        src: "${scriptUrl}"
        displayScope: ALL
      }) {
        scriptTag {
          id
          src
        }
        userErrors {
          field
          message
        }
      }
    }
  `);

	const result = await response.json();

	if (result.data?.scriptTagCreate?.userErrors?.length > 0) {
		return {
			success: false,
			error: result.data.scriptTagCreate.userErrors[0].message,
		};
	}

	return { success: true };
}

/**
 * Remove script tag via Shopify API
 */
export async function removeScriptTag(
	admin: { graphql: (query: string) => Promise<Response> },
	config: EntrolyticsConfig,
): Promise<{ success: boolean; error?: string }> {
	// First, find the script tag
	const findResponse = await admin.graphql(`
    query {
      scriptTags(first: 50) {
        edges {
          node {
            id
            src
          }
        }
      }
    }
  `);

	const findResult = await findResponse.json();
	const scriptTag = findResult.data?.scriptTags?.edges?.find(
		(edge: { node: { src: string } }) => edge.node.src.includes("entrolytics"),
	);

	if (!scriptTag) {
		return { success: true }; // Already removed
	}

	// Delete the script tag
	const deleteResponse = await admin.graphql(`
    mutation scriptTagDelete {
      scriptTagDelete(id: "${scriptTag.node.id}") {
        deletedScriptTagId
        userErrors {
          field
          message
        }
      }
    }
  `);

	const deleteResult = await deleteResponse.json();

	if (deleteResult.data?.scriptTagDelete?.userErrors?.length > 0) {
		return {
			success: false,
			error: deleteResult.data.scriptTagDelete.userErrors[0].message,
		};
	}

	return { success: true };
}
