import { useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, useSubmit, useNavigation } from '@remix-run/react';
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  Checkbox,
  Link,
  Box,
  Divider,
} from '@shopify/polaris';
import { authenticate } from '../../lib/shopify.server';
import {
  getShopConfig,
  saveShopConfig,
  installScriptTag,
  removeScriptTag,
} from '../../lib/entrolytics.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const config = await getShopConfig(session.shop);

  return json({
    shop: session.shop,
    config: config || {
      websiteId: '',
      host: 'https://ng.entrolytics.click',
      autoTrack: true,
      trackRevenue: true,
      respectDnt: false,
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get('action');

  if (action === 'save') {
    const config = {
      websiteId: formData.get('websiteId') as string,
      host: (formData.get('host') as string) || 'https://entrolytics.click',
      autoTrack: formData.get('autoTrack') === 'true',
      trackRevenue: formData.get('trackRevenue') === 'true',
      respectDnt: formData.get('respectDnt') === 'true',
    };

    if (!config.websiteId) {
      return json({ error: 'Website ID is required' }, { status: 400 });
    }

    await saveShopConfig(session.shop, config);

    // Install script tag
    const result = await installScriptTag(admin, config);

    if (!result.success) {
      return json({ error: result.error }, { status: 400 });
    }

    return json({ success: true, message: 'Analytics enabled successfully!' });
  }

  if (action === 'disable') {
    const config = await getShopConfig(session.shop);
    if (config) {
      await removeScriptTag(admin, config);
    }

    return json({ success: true, message: 'Analytics disabled' });
  }

  return json({ error: 'Unknown action' }, { status: 400 });
}

export default function Index() {
  const { shop, config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === 'submitting';

  const [websiteId, setWebsiteId] = useState(config.websiteId);
  const [host, setHost] = useState(config.host);
  const [autoTrack, setAutoTrack] = useState(config.autoTrack);
  const [trackRevenue, setTrackRevenue] = useState(config.trackRevenue);
  const [respectDnt, setRespectDnt] = useState(config.respectDnt);

  const handleSave = () => {
    const formData = new FormData();
    formData.set('action', 'save');
    formData.set('websiteId', websiteId);
    formData.set('host', host);
    formData.set('autoTrack', String(autoTrack));
    formData.set('trackRevenue', String(trackRevenue));
    formData.set('respectDnt', String(respectDnt));
    submit(formData, { method: 'post' });
  };

  const handleDisable = () => {
    const formData = new FormData();
    formData.set('action', 'disable');
    submit(formData, { method: 'post' });
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
                    Get your Website ID from your{' '}
                    <Link url="https://ng.entrolytics.click" target="_blank">
                      Entrolytics dashboard
                    </Link>
                  </>
                }
                placeholder="abc123-def456-ghi789"
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
                  disabled={!websiteId}
                >
                  {config.websiteId ? 'Update Settings' : 'Enable Analytics'}
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
                  <strong>1.</strong> Create an account at{' '}
                  <Link url="https://ng.entrolytics.click" target="_blank">
                    ng.entrolytics.click
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
                    We're privacy-focused: no cookies required, GDPR compliant,
                    and all data is anonymized.
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
