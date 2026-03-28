# Arcade x Shopify App

A fully embedded Shopify app that lets merchants browse product categories, design AI-generated products, and push manufacturer-ready listings directly to their Shopify store — all without leaving the Shopify Admin.

Modeled after [Printful's embedded Shopify integration](https://apps.shopify.com/printful), with three key differences:

- Arcade's manufacturer network produces a far broader range of product types beyond printed goods
- Product design is AI-generated entirely within the embedded experience
- Predefined product categories align designs with manufacturer capabilities from the start

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Shopify Remix](https://shopify.dev/docs/apps/build/scaffold) (official Shopify app template) |
| UI | [Polaris](https://polaris.shopify.com/) (Shopify's design system) |
| Embedded UI | [App Bridge 4](https://shopify.dev/docs/api/app-bridge) |
| Database | PostgreSQL + [Prisma](https://www.prisma.io/) |
| Auth | Shopify OAuth + session tokens |
| API | Shopify GraphQL Admin API |
| Hosting | Vercel |

## Architecture

```
┌──────────────────────────────────────────────────┐
│              SHOPIFY ADMIN (iframe)               │
│  ┌────────────────────────────────────────────┐  │
│  │    Arcade Embedded App (Remix + Polaris)    │  │
│  │                                             │  │
│  │  Categories → Product Type → AI Design      │  │
│  │  → Publish to Store                         │  │
│  │  Orders Dashboard                           │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
          │                          │
     App Bridge                Session Token
     Navigation                    Auth
          │                          │
┌───────────────────┐    ┌─────────────────────┐
│ Shopify GraphQL   │    │ Arcade Backend API   │
│ Admin API         │    │ - Account Provision  │
│ - productCreate   │    │ - AI Design Engine   │
│ - fulfillment     │    │ - Order Routing      │
│ - orders          │    │ - Manufacturer Mgmt  │
└───────────────────┘    └─────────────────────┘
          │                        │
┌───────────────────┐    ┌─────────────────────┐
│ Shopify Webhooks  │    │ Manufacturer Network │
│ - orders/create   │    │ - Fulfillment        │
│ - app/uninstalled │    │ - Tracking           │
│ - GDPR (x3)      │    └─────────────────────┘
└───────────────────┘
```

## Core User Flows

### 1. Install & Account Provisioning
Merchant installs from Shopify App Store → OAuth handshake → Arcade account auto-provisioned (or linked if email matches) → merchant lands in embedded app, never leaving Shopify Admin.

### 2. Browse & Design
Merchant browses predefined product categories (Apparel, Accessories, Home Goods, Stationery, Electronics Accessories) → selects a product type → enters AI design flow → prompts a design, refines it, confirms pricing and variants.

### 3. Publish to Store
Merchant clicks "Publish to Store" → product created in Shopify as **Draft** via GraphQL Admin API → merchant reviews and activates in Shopify Admin.

### 4. Order Fulfillment
Customer purchases on Shopify storefront → `orders/create` webhook fires → Arcade routes order to manufacturer → manufacturer fulfills and ships → tracking syncs back to Shopify via Fulfillment API → customer receives shipping notification.

## Data Model

| Entity | Purpose |
|--------|---------|
| **Shop** | Shopify store connection — domain, access token, linked Arcade account |
| **ArcadeProduct** | Product designed in Arcade — design data, pricing, variants, Shopify product GID |
| **ArcadeOrder** | Order from Shopify — manufacturer routing, fulfillment status, tracking |
| **ProductCategory** | Predefined categories (static for v1) — Apparel, Accessories, etc. |
| **ProductType** | Product types within categories — base price, variants, manufacturer mapping |

## Product Categories (v1)

| Category | Product Types |
|----------|--------------|
| Apparel | T-Shirts, Hoodies, Hats, Tank Tops, Jackets |
| Accessories | Tote Bags, Phone Cases, Jewelry, Watches, Sunglasses |
| Home Goods | Mugs, Pillows, Candles, Wall Art, Blankets |
| Stationery | Notebooks, Greeting Cards, Stickers, Posters |
| Electronics Accessories | Laptop Sleeves, Chargers, Cable Organizers |

## Project Structure

```
arcade-shopify-app/
├── app/
│   ├── routes/
│   │   ├── app._index.tsx          # Home — category browsing grid
│   │   ├── app.categories.$slug.tsx # Product type selection
│   │   ├── app.design.$type.tsx     # AI design flow
│   │   ├── app.orders.tsx           # Orders dashboard
│   │   ├── app.orders.$id.tsx       # Order detail
│   │   ├── auth.$.tsx               # OAuth callback
│   │   └── webhooks.tsx             # Webhook handlers
│   ├── components/                  # Shared Polaris components
│   ├── models/                      # Prisma client helpers
│   └── shopify.server.ts            # Shopify app config
├── prisma/
│   ├── schema.prisma                # Database schema
│   ├── migrations/                  # Prisma migrations
│   └── seed.ts                      # Category + product type seed data
├── public/                          # Static assets
├── shopify.app.toml                 # Shopify app configuration
├── package.json
├── tsconfig.json
└── remix.config.js
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) >= 3.0
- [Shopify Partners account](https://partners.shopify.com/)
- PostgreSQL database
- Shopify development store

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in: SHOPIFY_API_KEY, SHOPIFY_API_SECRET, DATABASE_URL, etc.

# Run database migrations
npx prisma migrate dev

# Seed product categories
npx prisma db seed

# Start development server (opens embedded app in Shopify Admin)
shopify app dev
```

### Environment Variables

| Variable | Description |
|----------|------------|
| `SHOPIFY_API_KEY` | App API key from Shopify Partners |
| `SHOPIFY_API_SECRET` | App API secret |
| `SCOPES` | `read_products,write_products,read_orders,write_orders,read_fulfillments,write_fulfillments` |
| `HOST` | App URL (ngrok/cloudflare tunnel for dev) |
| `DATABASE_URL` | PostgreSQL connection string |
| `ARCADE_API_URL` | Arcade backend API base URL |
| `ARCADE_API_KEY` | Arcade backend API key |

## Milestones

| Milestone | Target | Focus |
|-----------|--------|-------|
| **M1: Foundation** | Apr 1 | Scaffold, DB, OAuth, GDPR webhooks, designs, category data |
| **M2: Core Flows** | Apr 9 | Category UI, AI design flow, product push to Shopify |
| **M3: Order Pipeline** | Apr 15 | Order webhooks, manufacturer routing, fulfillment tracking |
| **M4: Testing & Polish** | Apr 21 | E2E testing, performance, App Bridge compliance, analytics |
| **M5: Beta & Submit** | Apr 25 | Beta with existing users, bug fixes, App Store submission |

## Shopify App Store Requirements

All of these must be met for App Store approval:

- [x] GraphQL Admin API only (no REST)
- [x] App Bridge for all embedded navigation
- [x] Session token auth (no cookies)
- [x] Polaris design system for all UI
- [x] GDPR webhooks: `customers/data_request`, `customers/redact`, `shop/redact`
- [x] `app/uninstalled` webhook handler
- [x] All scopes justified
- [x] Privacy policy URL
- [x] No external redirects during core flows

## MVP Scope Cuts

The following are explicitly deferred for v1:

- Account linking for different-email OAuth (Journey B State 3)
- Native Shopify orders page integration (Journey E Phase 2)
- Dynamic categories based on manufacturer availability
- Shopify Billing API integration
- Multi-store management UI
- Product update sync after push
- Pricing sync on manufacturer cost changes

## Links

- **Linear Project:** [Shopify Partnership App](https://linear.app/arcade-ai/project/shopify-partnership-app-d741d1114b76)
- **PRD:** [Shopify B2B Application (Notion)](https://www.notion.so/heretics/Shopify-B2B-Application-32c5fdc11eed8050a9fdd5171707885f)
- **Slack:** #arcade_b2b
- **Shopify Docs:** [Build a Shopify App](https://shopify.dev/docs/apps)

## Team

| Role | Owner |
|------|-------|
| Product | Michael |
| Product | Vivian |
| Frontend | TBD |
| Backend | TBD |
| AI | TBD |
