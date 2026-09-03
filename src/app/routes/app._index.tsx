import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  InlineStack,
  Layout,
  Link,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
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

  return json({
    shop: session.shop,
    config: config || {
      clientKey: "",
      websiteId: "",
      host: "https://api.entrolytics.click",
      autoTrack: true,
      trackRevenue: true,
      respectDnt: false,
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "save") {
    const parsedConfig = entrolyticsConfigSchema.safeParse({
      websiteId: formData.get("websiteId"),
      clientKey: formData.get("clientKey"),
      host: formData.get("host") || "https://api.entrolytics.click",
      autoTrack: formData.get("autoTrack") === "true",
      trackRevenue: formData.get("trackRevenue") === "true",
      respectDnt: formData.get("respectDnt") === "true",
    });

    if (!parsedConfig.success) {
      return json(
        { error: parsedConfig.error.issues.at(0)?.message ?? "Invalid configuration" },
        { status: 400 },
      );
    }

    const result = await installScriptTag(admin, session.shop);

    if (!result.success) {
      return json({ error: result.error }, { status: 400 });
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

    return json({ success: true, message: "Analytics enabled successfully!" });
  }

  if (action === "disable") {
    const config = await getShopConfig(session.shop);
    if (config) {
      const result = await removeScriptTag(admin, session.shop, config.scriptTagId);
      if (!result.success) {
        return json({ error: result.error }, { status: 400 });
      }
      await deleteShopConfig(session.shop);
    }

    return json({ success: true, message: "Analytics disabled" });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function Index() {
  const { config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const [websiteId, setWebsiteId] = useState(config.websiteId);
  const [clientKey, setClientKey] = useState(config.clientKey);
  const [host, setHost] = useState(config.host ?? "https://api.entrolytics.click");
  const [autoTrack, setAutoTrack] = useState(config.autoTrack);
  const [trackRevenue, setTrackRevenue] = useState(config.trackRevenue);
  const [respectDnt, setRespectDnt] = useState(config.respectDnt);

  const handleSave = () => {
    const formData = new FormData();
    formData.set("action", "save");
    formData.set("websiteId", websiteId);
    formData.set("clientKey", clientKey);
    formData.set("host", host || "https://api.entrolytics.click");
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
    <Page title="Entrolytics Analytics">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Connect Your Store to Entrolytics
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Track visitors, conversions, and revenue with privacy-focused analytics.
              </Text>

              <Divider />

              <TextField
                label="Website ID"
                value={websiteId}
                onChange={setWebsiteId}
                autoComplete="off"
                helpText={
                  <>
                    Get your Website ID from your{" "}
                    <Link url="https://entrolytics.click" target="_blank">
                      Entrolytics dashboard
                    </Link>
                  </>
                }
                placeholder="abc123-def456-ghi789"
              />

              <TextField
                label="Client key"
                value={clientKey}
                onChange={setClientKey}
                autoComplete="off"
                helpText="Use the public client key shown with the website tracking snippet"
                placeholder="cw_..."
              />

              <TextField
                label="Host URL"
                value={host}
                onChange={setHost}
                autoComplete="off"
                helpText="Leave default unless self-hosting Entrolytics"
              />

              <Divider />

              <Text as="h3" variant="headingMd">
                Tracking Options
              </Text>

              <BlockStack gap="200">
                <Checkbox
                  label="Auto-track page views"
                  checked={autoTrack}
                  onChange={setAutoTrack}
                  helpText="Automatically track when visitors view pages"
                />

                <Checkbox
                  label="Track e-commerce events"
                  checked={trackRevenue}
                  onChange={setTrackRevenue}
                  helpText="Track add-to-cart and purchase events with revenue data"
                />

                <Checkbox
                  label="Respect Do Not Track"
                  checked={respectDnt}
                  onChange={setRespectDnt}
                  helpText="Honor browser's Do Not Track setting"
                />
              </BlockStack>

              <Divider />

              <InlineStack gap="300">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={isLoading}
                  disabled={!websiteId || !clientKey}
                >
                  {config.websiteId ? "Update Settings" : "Enable Analytics"}
                </Button>

                {config.websiteId && (
                  <Button
                    variant="plain"
                    tone="critical"
                    onClick={handleDisable}
                    loading={isLoading}
                  >
                    Disable Analytics
                  </Button>
                )}
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Getting Started
              </Text>

              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  <strong>1.</strong> Create an account at{" "}
                  <Link url="https://entrolytics.click" target="_blank">
                    entrolytics.click
                  </Link>
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>2.</strong> Add your store as a website
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>3.</strong> Copy your Website ID
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>4.</strong> Paste it here and enable
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Box paddingBlockStart="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  What We Track
                </Text>

                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">
                    ✓ Page views
                  </Text>
                  <Text as="p" variant="bodyMd">
                    ✓ Visitor sessions
                  </Text>
                  <Text as="p" variant="bodyMd">
                    ✓ Add to cart events
                  </Text>
                  <Text as="p" variant="bodyMd">
                    ✓ Purchases & revenue
                  </Text>
                  <Text as="p" variant="bodyMd">
                    ✓ Traffic sources
                  </Text>
                  <Text as="p" variant="bodyMd">
                    ✓ Device & location data
                  </Text>
                </BlockStack>

                <Banner tone="info">
                  <Text as="p" variant="bodyMd">
                    We're privacy-focused: no cookies required, GDPR compliant, and all data is
                    anonymized.
                  </Text>
                </Banner>
              </BlockStack>
            </Card>
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
