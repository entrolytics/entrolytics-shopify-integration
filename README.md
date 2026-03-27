<div align="center">
- <img src="https://raw.githubusercontent.com/entrolytics/.github/main/media/entrov2.png" alt="Entrolytics" width="64" height="64">

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Shopify](https://img.shields.io/badge/Shopify-App-7AB55C.svg?logo=shopify\&logoColor=white)](https://apps.shopify.com/)
[![Remix](https://img.shields.io/badge/Remix-2.0-000000.svg?logo=remix)](https://remix.run/)

</div>

---

## Overview

**Entrolytics Shopify App** is the official Shopify app for Entrolytics - first-party growth analytics for the edge. Add powerful e-commerce analytics to your Shopify store with one click.

**Why use this app?**

- Automatic add-to-cart and purchase tracking
- Revenue analytics with conversion rates
- GDPR compliant, cookie-free tracking
- Real-time dashboard with store metrics

## Key Features

<table>
<tr>
<td width="50%">

### E-commerce Analytics

- Add to cart tracking
- Purchase and revenue tracking
- Conversion rate analytics
- Traffic source analysis

</td>
<td width="50%">

### Privacy & Compliance

- Cookie-free tracking
- GDPR compliant
- IP anonymization
- Optional DNT respect

</td>
</tr>
</table>

## Quick Start

<table>
<tr>
<td align="center" width="25%">
<img src="https://api.iconify.design/lucide:download.svg?color=%236366f1" width="48"><br>
<strong>1. Install</strong><br>
Shopify App Store
</td>
<td align="center" width="25%">
<img src="https://api.iconify.design/lucide:link.svg?color=%236366f1" width="48"><br>
<strong>2. Connect</strong><br>
Enter Website ID
</td>
<td align="center" width="25%">
<img src="https://api.iconify.design/lucide:check-circle.svg?color=%236366f1" width="48"><br>
<strong>3. Enable</strong><br>
Click Enable Analytics
</td>
<td align="center" width="25%">
<img src="https://api.iconify.design/lucide:bar-chart-3.svg?color=%236366f1" width="48"><br>
<strong>4. Track</strong><br>
View analytics in dashboard
</td>
</tr>
</table>

## Features

- **One-click Setup**: Install from Shopify App Store and connect in seconds
- **E-commerce Tracking**: Automatic tracking of add-to-cart and purchase events
- **Revenue Analytics**: Track revenue, order count, and conversion rates
- **Privacy-Focused**: GDPR compliant, no cookies required
- **Real-time Dashboard**: View your analytics in real-time

## Installation

### From Shopify App Store

1. Visit the [Entrolytics app](https://apps.shopify.com/entrolytics) in the Shopify App Store
2. Click "Add app"
3. Enter your Entrolytics Website ID
4. Click "Enable Analytics"

### What Gets Tracked

Once enabled, the app automatically tracks:

- **Page Views**: Every page visit on your store
- **Add to Cart**: When customers add items to cart
- **Purchases**: Completed orders with revenue data
- **Sessions**: Visitor sessions and bounce rate
- **Traffic Sources**: Where your visitors come from
- **Device Data**: Browser, device type, and screen size
- **Location**: Country and city (anonymized)

## Configuration Options

| Option           | Description                        | Default                     |
| ---------------- | ---------------------------------- | --------------------------- |
| Website ID       | Your Entrolytics website ID        | Required                    |
| Host URL         | Entrolytics host (for self-hosted) | `https://entrolytics.click` |
| Auto-track       | Automatically track page views     | `true`                      |
| Track e-commerce | Track add-to-cart and purchases    | `true`                      |
| Respect DNT      | Honor Do Not Track setting         | `false`                     |

## Development

This app is built with:

- [Remix](https://remix.run) - Full-stack web framework
- [Shopify App Remix](https://github.com/Shopify/shopify-app-js) - Shopify app toolkit
- [Polaris](https://polaris.shopify.com) - Shopify design system
- [Prisma](https://prisma.io) - Database ORM

### Setup

```bash

# Install dependencies

pnpm install

# Setup database

pnpm prisma migrate dev

# Start development server

pnpm dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:

- `SHOPIFY_API_KEY` - Your Shopify app API key
- `SHOPIFY_API_SECRET` - Your Shopify app API secret
- `SHOPIFY_APP_URL` - Your app's public URL
- `DATABASE_URL` - PostgreSQL connection string

### Deploy

```bash

# Deploy to Shopify

pnpm deploy
```

## How It Works

1. **Installation**: Merchant installs app and authenticates via OAuth
2. **Configuration**: Merchant enters their Entrolytics Website ID
3. **Script Injection**: App uses Shopify's Script Tag API to inject tracking
4. **Data Collection**: Entrolytics script collects analytics data
5. **Dashboard**: Merchant views analytics at entrolytics.click

### Script Tag Injection

The app injects a script tag into the store's theme that:

- Loads the Entrolytics tracking script
- Configures it with the merchant's Website ID
- Sets up e-commerce event listeners for add-to-cart and purchase

### E-commerce Events

The injected script automatically tracks:

```javascript
// Add to cart (on button click)
window.entrolytics.track("add_to_cart");

// Purchase (on thank you page)
window.entrolytics.track("purchase", {
  revenue: 99.99,
  currency: "USD",
  order_id: "12345",
  items: 3,
});
```

## Privacy & Compliance

- **No Cookies**: Cookie-free tracking by default
- **GDPR Compliant**: No personal data stored without consent
- **IP Anonymization**: IP addresses are hashed before storage
- **Do Not Track**: Optionally respect browser DNT setting

## Support

- **Documentation**: [docs.entrolytics.click](https://docs.entrolytics.click)
- **Email**: <hey@entrolytics.click>
- **GitHub**: [github.com/entro314-labs](https://github.com/entro314-labs)

## License

MIT License - see [LICENSE](LICENSE) for details.
