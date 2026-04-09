# Arcade x Shopify App

A fully embedded Shopify app that lets merchants browse a visual grid of home textile product categories, design AI-generated products via structured prompts, configure per-variant pricing and markup, and publish manufacturer-ready listings directly to their Shopify store — all without leaving the Shopify Admin.

Modeled after [Printful's embedded Shopify integration](https://apps.shopify.com/printful), with three key differences:

- Arcade's manufacturer network produces a far broader range of product types beyond printed goods
- Product design is AI-generated entirely within the embedded experience — no artwork upload needed
- A visual grid of product categories (v1: home textiles) aligns designs with manufacturer capabilities from the start

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [React Router v7](https://reactrouter.com/) via [`@shopify/shopify-app-react-router`](https://www.npmjs.com/package/@shopify/shopify-app-react-router) — **target stack for all new work**. The current tree is still on the legacy `@shopify/shopify-app-remix` scaffold; see [ADR 0001](docs/adr/0001-remix-to-react-router.md) for the migration plan. |
| UI | [Polaris](https://polaris.shopify.com/) (Shopify's design system) |
| Embedded UI | [App Bridge 4](https://shopify.dev/docs/api/app-bridge) |
| Database | PostgreSQL + [Prisma](https://www.prisma.io/) |
| Auth | Shopify OAuth + session tokens |
| API | Shopify GraphQL Admin API |
| Hosting | Vercel |

## Ticket requirements (read before opening or picking up work)

Per [ADR 0001](docs/adr/0001-remix-to-react-router.md), this repo is
migrating off Remix. The migration runs as M0 and is a hard prerequisite
for any new M2+ feature work. While M0 is in flight:

- **New tickets must be scoped against React Router**, not Remix. Write
  acceptance criteria, snippets, and file paths as they will exist in
  the rescaffolded repo. A ticket that says "add a Remix loader for X"
  should be rewritten before it gets picked up.
- **No new `@remix-run/*` or `@shopify/shopify-app-remix` imports** in
  code changes. New files are written against React Router v7 /
  `@shopify/shopify-app-react-router` from day one. If you are editing
  an existing Remix file, match the local style but do not *spread*
  Remix imports to new files.
- **Bug fixes against existing Remix files are still allowed** — we
  cannot ship broken code while waiting on M0 — but must stay minimal.
  Anything larger than an import-swap or a surgical correction gets
  rolled into the rescaffold instead.
- **Every new loader/action must scope its DB writes by
  `session.shop`**, never by `db.shop.findFirst()`. This is blocker B3
  in the ADR and applies to both Remix and React Router files.

If a ticket's scope does not fit inside these rules, escalate at triage
rather than working around them.

## Architecture

```
┌───────────────────────────────────────────────────────┐
│                 SHOPIFY ADMIN (iframe)                 │
│  ┌─────────────────────────────────────────────────┐  │
│  │   Arcade Embedded App (React Router + Polaris)  │  │
│  │                                                  │  │
│  │  Onboarding → Category Grid → Product Type      │  │
│  │  → Prompt Design → AI Design (PDP)              │  │
│  │  → Pricing Config → Publish to Store            │  │
│  │  Orders Dashboard (tabbed) · Edit Product       │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
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

### 1. Install & Account Provisioning (Journey A + B)

Merchant installs from Shopify App Store → OAuth handshake → Arcade account auto-provisioned (or linked if email matches) → merchant lands in onboarding welcome screen ("Turn thoughts into things") with value props and a 3-step overview (Browse & Choose → Design with AI → Publish & Sell) → clicks "Get Started" → enters category grid.

**OAuth states:**
- **No Arcade account:** Auto-provision silently, land in embedded app
- **Matching email:** Auto-link to existing account
- **Different email (post-MVP):** Falls back to auto-provision with merge-later note

### 2. Browse Categories (Journey C, Steps 1–3)

Merchant sees a **visual grid of product category tiles** (Scarves, Decorative Pillows, Table Linens, etc.) → selects a category → sees available product types within it (e.g., under Decorative Pillows: Square Throw Pillow Cover, Lumbar Pillow Cover, Euro Sham Cover, Outdoor Pillow Cover) with thumbnail, specs, base price, and "Design" CTA.

### 3. Prompt Design (Journey C, Step 4)

Merchant clicks "Design" → enters the **Prompt Design screen**: a text area for describing the desired design, plus structured input chips for Category, Colors, Artist style, and Image upload → submits the prompt.

### 4. AI Design Flow (Journey C, Step 5)

PDP-style layout: AI-generated product imagery with thumbnail variants on the left, product details on the right (name, base product type, price + shipping, original prompt with "Regenerate Design" option). Merchant selects variants via checkboxes:
- **Sizes** (e.g., 11x11", 16x16", 18x18", 20x20" with "Select all")
- **Fabrics** (e.g., Cotton Canvas, Linen, Velvet with "Select all")

Manufacturer attribution shown at bottom (e.g., "Made by Esme Textiles"). Merchant can "Edit Design" to iterate or "Save Draft" to come back later.

### 5. Review, Price & Publish (Journey C, Steps 8–11)

Side-by-side view: product preview on left, details on right (Title, Description, Base Price, Your Price, Profit, Sizes, Colors). A **Pricing step** lets the merchant configure a retail markup percentage and edit per-variant retail prices with a table showing Variant, Product Cost, Retail Price, and Estimated Earnings.

Merchant clicks **"Publish to Store"** → product created via Shopify GraphQL Admin API as **Active** (immediately live) → success confirmation with CTAs for "View in Shopify Admin" and "Create Another Product".

### 6. Edit Product (Journey F)

Post-publish editing within the embedded app: title, rich text description (with AI assist), status toggle (Active/Draft), publishing channel display, and sales summary.

### 7. Order Fulfillment (Journey D)

Customer purchases on Shopify storefront → `orders/create` webhook fires → Arcade receives order + charges merchant's Arcade billing method for manufacturing cost → routes to manufacturer → manufacturer fulfills and ships → tracking syncs back to Shopify via Fulfillment API → customer receives branded shipping notification.

### 8. Orders Dashboard (Journey E)

Tabbed interface: **All | Unfulfilled | In Production | Shipped | Delivered** (with badge counts). Filterable by search, status, date, sort. Table columns: Order #, Date, Customer, Product, Payment (Paid/Pending/Refunded), Fulfillment status, Total. Drill-down via row menu for manufacturer details, tracking, ETA. Export and manual "Create order" supported. Paginated.

## Data Model

| Entity | Purpose |
|--------|---------|
| **Shop** | Shopify store connection — domain, access token, linked Arcade account |
| **ArcadeProduct** | Product designed in Arcade — design prompt, AI imagery, Shopify product GID, status (draft/active) |
| **ProductVariant** | Per-variant config — size, fabric, product cost, retail price, markup % |
| **ArcadeOrder** | Order from Shopify — manufacturer routing, fulfillment status, tracking, payment status |
| **ProductCategory** | Predefined categories (static for v1) — visual grid tile with image |
| **ProductType** | Product types within categories — specs, base price, size options, fabric options, manufacturer mapping |
| **Manufacturer** | Manufacturer in Arcade's network — name, capabilities, fulfillment capacity |

## Product Categories

### v1 — Home Textiles (aligned with current manufacturer capabilities)

Displayed as a flat visual grid of tiles on the home screen:

| Category | Example Product Types |
|----------|----------------------|
| Scarves | — |
| Decorative Pillows | Square Throw Pillow Cover, Lumbar Pillow Cover, Euro Sham Cover, Outdoor Pillow Cover |
| Table Linens | — |
| Napkins | — |
| Placemats | — |
| Tablecloths | — |
| Table Runners | — |
| Duvet Covers | — |
| Shams | — |
| Quilts | — |
| Quilted Shams | — |
| Curtains | — |
| Lampshades | — |

Categories are **static at launch** for simplicity and quality control.

### v2 — Expanded Verticals (future)

| Category | Product Types |
|----------|--------------|
| Apparel | T-Shirts, Hoodies, Hats, Tank Tops, Jackets |
| Accessories | Tote Bags, Phone Cases, Jewelry, Watches, Sunglasses |
| Home Goods | Mugs, Candles, Wall Art, Blankets |
| Stationery | Notebooks, Greeting Cards, Stickers, Posters |
| Electronics Accessories | Laptop Sleeves, Chargers, Cable Organizers |

## Screen Inventory

| Screen | Route | Description |
|--------|-------|-------------|
| Onboarding | `app._index` | Welcome: "Turn thoughts into things", value props, 3-step overview, "Get Started" CTA |
| Category Grid | `app.categories._index` | Visual grid of 13 home textile category tiles |
| Product Type Selection | `app.categories.$slug` | Product types within category — thumbnail, specs, base price, "Design" CTA |
| Prompt Design | `app.design.prompt` | Text area + structured chips (Category, Colors, Artist, Image upload) |
| AI Design (PDP) | `app.design.$id` | AI imagery left, details right, size + fabric checkboxes, manufacturer attribution |
| Review & Pricing | `app.design.$id.pricing` | Side-by-side preview, markup % control, per-variant pricing table |
| Publish Confirmation | (modal) | Success state with "View in Shopify Admin" + "Create Another Product" |
| Edit Product | `app.products.$id` | Title, rich text editor (AI assist), status toggle, publishing, sales |
| Orders Dashboard | `app.orders` | Tabbed (All/Unfulfilled/In Production/Shipped/Delivered), filterable, exportable |
| Order Detail | `app.orders.$id` | Manufacturer, ETA, tracking, carrier, status timeline |

## Project Structure

```
arcade-shopify-app/
├── app/
│   ├── routes/
│   │   ├── app._index.tsx              # Onboarding / home
│   │   ├── app.categories._index.tsx   # Category browsing grid
│   │   ├── app.categories.$slug.tsx    # Product type selection
│   │   ├── app.design.prompt.tsx       # Prompt design screen
│   │   ├── app.design.$id.tsx          # AI design flow (PDP layout)
│   │   ├── app.design.$id.pricing.tsx  # Review & pricing config
│   │   ├── app.products.$id.tsx        # Edit product details
│   │   ├── app.orders.tsx              # Orders dashboard (tabbed)
│   │   ├── app.orders.$id.tsx          # Order detail
│   │   ├── auth.$.tsx                  # OAuth callback
│   │   └── webhooks.tsx                # Webhook handlers
│   ├── components/
│   │   ├── CategoryGrid.tsx            # Visual grid of category tiles
│   │   ├── ProductTypeCard.tsx         # Product type row with specs
│   │   ├── PromptInput.tsx             # Design prompt + structured chips
│   │   ├── DesignPreview.tsx           # AI-generated imagery display
│   │   ├── VariantSelector.tsx         # Size + fabric checkboxes
│   │   ├── PricingTable.tsx            # Per-variant pricing editor
│   │   ├── OrdersTable.tsx             # Tabbed orders with filters
│   │   └── RichTextEditor.tsx          # Product description editor
│   ├── models/                         # Prisma client helpers
│   └── shopify.server.ts              # Shopify app config
├── prisma/
│   ├── schema.prisma                   # Database schema
│   ├── migrations/                     # Prisma migrations
│   └── seed.ts                         # Category + product type seed data
├── public/                             # Static assets (category images)
├── docs/
│   └── adr/                            # Architecture decision records
├── shopify.app.toml                    # Shopify app configuration (dev)
├── shopify.app.arcadeai.toml           # Shopify app configuration (prod)
├── vite.config.ts
├── package.json
└── tsconfig.json
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

# Seed product categories (13 home textile categories)
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

| Milestone | Focus |
|-----------|-------|
| **M0: React Router rescaffold** | Rescaffold the app against `@shopify/shopify-app-react-router`, port loaders/actions/webhooks/Prisma, clear `npm audit` findings, lock in the pre-migration blockers (B1–B4 in [ADR 0001](docs/adr/0001-remix-to-react-router.md)). Must land before M2 tickets begin. |
| **M1: Foundation** | Scaffold, DB, OAuth, GDPR webhooks, designs, category seed data. |
| **M2: Core Flows** | Onboarding, category grid, prompt design, AI design PDP, variant selection, pricing config, publish to Shopify. *All M2 work is written against React Router, not Remix.* |
| **M3: Order Pipeline** | Order webhooks, manufacturer routing, fulfillment tracking, orders dashboard. |
| **M4: Testing & Polish** | E2E testing, embedded performance, App Bridge compliance, analytics, edit product flow. |
| **M5: Beta & Submit** | Beta with existing users, bug fixes, App Store submission. |

## Shopify App Store Requirements

All of these must be met for App Store approval:

- [ ] GraphQL Admin API only (no REST)
- [ ] App Bridge for all embedded navigation
- [ ] Session token auth (no cookies)
- [ ] Polaris design system for all UI
- [ ] GDPR webhooks: `customers/data_request`, `customers/redact`, `shop/redact`
- [ ] `app/uninstalled` webhook handler
- [ ] All scopes justified
- [ ] Privacy policy URL
- [ ] No external redirects during core flows

## MVP Scope Cuts

The following are explicitly deferred for v1:

- Account linking for different-email OAuth (Journey B State 3)
- Native Shopify orders page integration (Journey E Phase 2)
- Dynamic categories reflecting manufacturer availability
- v2 category expansion (Apparel, Accessories, Stationery, Electronics)
- Shopify Billing API integration
- Multi-store management UI
- Product update sync after design changes
- Pricing sync on manufacturer cost changes

## Permissions & User Types

| Role | Access |
|------|--------|
| Store owner / admin | Full: connect store, browse, design, push products, view orders |
| Staff (product perms) | Browse, design, push products — cannot manage store connection |
| Anonymous | No access — OAuth required |

## Links

- **Linear Project:** [Shopify Partnership App](https://linear.app/arcade-ai/project/shopify-partnership-app-d741d1114b76)
- **PRD:** [Shopify B2B Application (Notion)](https://www.notion.so/heretics/Shopify-B2B-Application-32c5fdc11eed8050a9fdd5171707885f)
- **Slack:** #arcade_b2b
- **Shopify Docs:** [Build a Shopify App](https://shopify.dev/docs/apps)

## Team

| Role | Owner |
|------|-------|
| Product | Michael, Vivian |
| Frontend | TBD |
| Backend | TBD |
| AI | TBD |
| Design | TBD |
