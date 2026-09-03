import { z } from "zod";

import { prisma } from "./db.server";
import { entrolyticsConfigSchema, type ParsedEntrolyticsConfig } from "./entrolytics-config";

export type EntrolyticsConfig = ParsedEntrolyticsConfig & {
  scriptTagId?: string | null;
};

interface AdminGraphql {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

const scriptTagsResultSchema = z.object({
  data: z.object({
    scriptTags: z.object({
      edges: z.array(z.object({ node: z.object({ id: z.string(), src: z.url() }) })),
    }),
  }),
});

const scriptTagCreateResultSchema = z.object({
  data: z.object({
    scriptTagCreate: z.object({
      scriptTag: z.object({ id: z.string(), src: z.url() }).nullable(),
      userErrors: z.array(z.object({ message: z.string() })),
    }),
  }),
});

const scriptTagDeleteResultSchema = z.object({
  data: z.object({
    scriptTagDelete: z.object({
      userErrors: z.array(z.object({ message: z.string() })),
    }),
  }),
});

export async function getShopConfig(shop: string): Promise<EntrolyticsConfig | null> {
  const config = await prisma.entrolyticsConfig.findUnique({ where: { shop } });
  if (!config) return null;

  return {
    autoTrack: config.autoTrack,
    clientKey: config.clientKey,
    host: config.host,
    respectDnt: config.respectDnt,
    scriptTagId: config.scriptTagId,
    trackRevenue: config.trackRevenue,
    websiteId: config.websiteId,
  };
}

export async function saveShopConfig(
  shop: string,
  config: EntrolyticsConfig,
): Promise<void> {
  const parsed = entrolyticsConfigSchema.parse(config);
  await prisma.entrolyticsConfig.upsert({
    where: { shop },
    update: {
      ...parsed,
      scriptTagId: config.scriptTagId ?? null,
      updatedAt: new Date(),
    },
    create: {
      shop,
      ...parsed,
      scriptTagId: config.scriptTagId ?? null,
    },
  });
}

export async function deleteShopConfig(shop: string): Promise<void> {
  await prisma.entrolyticsConfig.deleteMany({ where: { shop } });
}

function getTrackerBootstrapUrl(shop: string): string {
  const appUrl = process.env.SHOPIFY_APP_URL;
  if (!appUrl) throw new Error("SHOPIFY_APP_URL is required");

  const url = new URL("/tracker.js", appUrl);
  url.searchParams.set("shop", shop);
  return url.toString();
}

async function findEntrolyticsScriptTag(
  admin: AdminGraphql,
  shop: string,
): Promise<{ id: string; src: string } | null> {
  const response = await admin.graphql(`
    query EntrolyticsScriptTags {
      scriptTags(first: 50) {
        edges { node { id src } }
      }
    }
  `);
  const result = scriptTagsResultSchema.parse(await response.json());
  const expectedUrl = getTrackerBootstrapUrl(shop);
  return result.data.scriptTags.edges.find(({ node }) => node.src === expectedUrl)?.node ?? null;
}

export async function installScriptTag(
  admin: AdminGraphql,
  shop: string,
): Promise<
  | { success: true; scriptTagId: string; created: boolean }
  | { success: false; error: string }
> {
  const existing = await findEntrolyticsScriptTag(admin, shop);
  if (existing) return { success: true, scriptTagId: existing.id, created: false };

  const response = await admin.graphql(
    `
      mutation EntrolyticsScriptTagCreate($input: ScriptTagInput!) {
        scriptTagCreate(input: $input) {
          scriptTag { id src }
          userErrors { message }
        }
      }
    `,
    {
      variables: {
        input: {
          cache: true,
          displayScope: "ONLINE_STORE",
          src: getTrackerBootstrapUrl(shop),
        },
      },
    },
  );
  const result = scriptTagCreateResultSchema.parse(await response.json());
  const { scriptTag, userErrors } = result.data.scriptTagCreate;
  if (userErrors.length > 0 || !scriptTag) {
    return { success: false, error: userErrors.at(0)?.message ?? "Script tag was not created" };
  }

  return { success: true, scriptTagId: scriptTag.id, created: true };
}

export async function removeScriptTag(
  admin: AdminGraphql,
  shop: string,
  scriptTagId?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const id = scriptTagId ?? (await findEntrolyticsScriptTag(admin, shop))?.id;
  if (!id) return { success: true };

  const response = await admin.graphql(
    `
      mutation EntrolyticsScriptTagDelete($id: ID!) {
        scriptTagDelete(id: $id) {
          userErrors { message }
        }
      }
    `,
    { variables: { id } },
  );
  const result = scriptTagDeleteResultSchema.parse(await response.json());
  const error = result.data.scriptTagDelete.userErrors.at(0)?.message;
  return error ? { success: false, error } : { success: true };
}
