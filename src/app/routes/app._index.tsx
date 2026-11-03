import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, useLoaderData, useNavigation, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useState } from "react";
import { entrolyticsConfigSchema } from "../../lib/entrolytics-config";
import {
  deleteShopConfig,
  getShopConfig,
  installScriptTag,
  removeScriptTag,
  saveShopConfig,
} from "../../lib/entrolytics.server";
import { authenticate } from "../../lib/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const config = await getShopConfig(session.shop);

  return {
    shop: session.shop,
    config: config || {
      clientKey: "",
      websiteId: "",
      host: "https://api.entrolytics.dev",
      autoTrack: true,
      trackRevenue: true,
      respectDnt: false,
    },
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "save") {
    const parsedConfig = entrolyticsConfigSchema.safeParse({
      websiteId: formData.get("websiteId"),
      clientKey: formData.get("clientKey"),
      host: formData.get("host") || "https://api.entrolytics.dev",
      autoTrack: formData.get("autoTrack") === "true",
      trackRevenue: formData.get("trackRevenue") === "true",
      respectDnt: formData.get("respectDnt") === "true",
    });

    if (!parsedConfig.success) {
      return data(
        { error: parsedConfig.error.issues.at(0)?.message ?? "Invalid configuration" },
        { status: 400 },
      );
    }

    const result = await installScriptTag(admin, session.shop);

    if (!result.success) {
      return data({ error: result.error }, { status: 400 });
    }

    try {
      await saveShopConfig(session.shop, {
        ...parsedConfig.data,
        scriptTagId: result.scriptTagId,
      });
    } catch (error) {
      if (result.created) {
        await removeScriptTag(admin, session.shop, result.scriptTagId);
      }
      throw error;
    }

    return { success: true, message: "Analytics enabled successfully!" };
  }

  if (action === "disable") {
    const config = await getShopConfig(session.shop);
    if (config) {
      const result = await removeScriptTag(admin, session.shop, config.scriptTagId);
      if (!result.success) {
        return data({ error: result.error }, { status: 400 });
      }
      await deleteShopConfig(session.shop);
    }

    return { success: true, message: "Analytics disabled" };
  }

  return data({ error: "Unknown action" }, { status: 400 });
}

export default function Index() {
  const { config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const [websiteId, setWebsiteId] = useState(config.websiteId);
  const [clientKey, setClientKey] = useState(config.clientKey);
  const [host, setHost] = useState(config.host ?? "https://api.entrolytics.dev");
  const [autoTrack, setAutoTrack] = useState(config.autoTrack);
  const [trackRevenue, setTrackRevenue] = useState(config.trackRevenue);
  const [respectDnt, setRespectDnt] = useState(config.respectDnt);

  const handleSave = () => {
    const formData = new FormData();
    formData.set("action", "save");
    formData.set("websiteId", websiteId);
    formData.set("clientKey", clientKey);
    formData.set("host", host || "https://api.entrolytics.dev");
    formData.set("autoTrack", String(autoTrack));
    formData.set("trackRevenue", String(trackRevenue));
    formData.set("respectDnt", String(respectDnt));
    submit(formData, { method: "post" });
  };

  const handleDisable = () => {
    const formData = new FormData();
    formData.set("action", "disable");
    submit(formData, { method: "post" });
  };

  return (
    <s-page heading="Entrolytics Analytics">
      <s-section heading="Connect Your Store to Entrolytics">
        <s-stack gap="base">
          <s-paragraph color="subdued">
            Track visitors, conversions, and revenue with privacy-focused analytics.
          </s-paragraph>

          <s-divider />

          <s-text-field
            label="Website ID"
            value={websiteId}
            onInput={(event) => setWebsiteId(event.currentTarget.value)}
            autocomplete="off"
            placeholder="abc123-def456-ghi789"
          >
            <s-text slot="details">
              Get your Website ID from your{" "}
              <s-link href="https://entrolytics.dev" target="_blank">
                Entrolytics dashboard
              </s-link>
            </s-text>
          </s-text-field>

          <s-text-field
            label="Client key"
            value={clientKey}
            onInput={(event) => setClientKey(event.currentTarget.value)}
            autocomplete="off"
            details="Use the public client key shown with the website tracking snippet"
            placeholder="cw_..."
          />

          <s-text-field
            label="Host URL"
            value={host}
            onInput={(event) => setHost(event.currentTarget.value)}
            autocomplete="off"
            details="Leave default unless self-hosting Entrolytics"
          />

          <s-divider />

          <s-heading>Tracking Options</s-heading>

          <s-stack gap="small-200">
            <s-checkbox
              label="Auto-track page views"
              checked={autoTrack}
              onChange={(event) => setAutoTrack(event.currentTarget.checked)}
              details="Automatically track when visitors view pages"
            />

            <s-checkbox
              label="Track e-commerce events"
              checked={trackRevenue}
              onChange={(event) => setTrackRevenue(event.currentTarget.checked)}
              details="Track add-to-cart and purchase events with revenue data"
            />

            <s-checkbox
              label="Respect Do Not Track"
              checked={respectDnt}
              onChange={(event) => setRespectDnt(event.currentTarget.checked)}
              details="Honor browser's Do Not Track setting"
            />
          </s-stack>

          <s-divider />

          <s-stack direction="inline" gap="small-100">
            <s-button
              variant="primary"
              onClick={handleSave}
              loading={isLoading}
              disabled={!websiteId || !clientKey}
            >
              {config.websiteId ? "Update Settings" : "Enable Analytics"}
            </s-button>

            {config.websiteId && (
              <s-button
                variant="tertiary"
                tone="critical"
                onClick={handleDisable}
                loading={isLoading}
              >
                Disable Analytics
              </s-button>
            )}
          </s-stack>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Getting Started">
        <s-stack gap="small-200">
          <s-paragraph>
            <s-text type="strong">1.</s-text> Create an account at{" "}
            <s-link href="https://entrolytics.dev" target="_blank">
              entrolytics.dev
            </s-link>
          </s-paragraph>
          <s-paragraph>
            <s-text type="strong">2.</s-text> Add your store as a website
          </s-paragraph>
          <s-paragraph>
            <s-text type="strong">3.</s-text> Copy your Website ID
          </s-paragraph>
          <s-paragraph>
            <s-text type="strong">4.</s-text> Paste it here and enable
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="What We Track">
        <s-stack gap="base">
          <s-stack gap="small-300">
            <s-paragraph>✓ Page views</s-paragraph>
            <s-paragraph>✓ Visitor sessions</s-paragraph>
            <s-paragraph>✓ Add to cart events</s-paragraph>
            <s-paragraph>✓ Purchases & revenue</s-paragraph>
            <s-paragraph>✓ Traffic sources</s-paragraph>
            <s-paragraph>✓ Device & location data</s-paragraph>
          </s-stack>

          <s-banner tone="info">
            <s-paragraph>
              We're privacy-focused: no cookies required, GDPR compliant, and all data is
              anonymized.
            </s-paragraph>
          </s-banner>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
