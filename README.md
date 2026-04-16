# Arcade x Shopify App

A fully embedded Shopify app that lets merchants browse a visual grid of home textile product categories, design AI-generated products via structured prompts, configure per-variant pricing and markup, and publish manufacturer-ready listings directly to their Shopify store — all without leaving the Shopify Admin.

Modeled after [Printful's embedded Shopify integration](https://apps.shopify.com/printful), with three key differences:

- Arcade's manufacturer network produces a far broader range of product types beyond printed goods
- Product design is AI-generated entirely within the embedded experience — no artwork upload needed
- A visual grid of product categories (v1: home textiles) aligns designs with manufacturer capabilities from the start

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [React Router v7](https://reactrouter.com/) via [`@shopify/shopify-app-react-router`](https://www.npmjs.com/package/@shopify/shopify-app-react-router) |
| UI | [Polaris](https://polaris.shopify.com/) + [Tailwind CSS v4](https://tailwindcss.com/) with custom design tokens |
| Icons | [Lucide React](https://lucide.dev/) |
| Embedded UI | [App Bridge 4](https://shopify.dev/docs/api/app-bridge) |
| Database | PostgreSQL + [Prisma](https://www.prisma.io/) |
| Auth | Shopify OAuth + session tokens; Firebase Auth for Arcade API identity |
| AI Design API | Arcade Backend (REST) with Firebase ID token auth |
| Real-time | [Firebase Firestore](https://firebase.google.com/docs/firestore) (client-side `onSnapshot` for design generation progress) |
| Validation | [Zod v4](https://zod.dev/) for runtime env validation |
| API | Shopify GraphQL Admin API (`2026-01`) |
| Hosting | Vercel |

## Ticket requirements (read before opening or picking up work)

- All code uses **React Router v7** / `@shopify/shopify-app-react-router`.
  There are zero `@remix-run/*` or `@shopify/shopify-app-remix` imports
  in the codebase ([ADR 0001](docs/adr/0001-remix-to-react-router.md) M0
  completed).
- **Every new loader/action must scope its DB writes by
  `session.shop`**, never by `db.shop.findFirst()`.
- Routes use **explicit code-based config** in `app/routes.ts` — do not
  rely on filesystem conventions. When adding a new route, register it
  in `routes.ts` and place the file in the matching nested folder.
- Server-only modules use the `.server.ts` suffix to guarantee they are
  tree-shaken from client bundles.
- Environment variables are validated at startup via Zod schemas in
  `app/lib/env/`. Add new vars to the schema *and* `.env.example`.
- **Never commit secrets.** `.env` and all variants are gitignored.
  `.env.example` must only contain empty values. If a credential is
  accidentally committed, rotate it immediately — git history is
  permanent. See [Rule 1](docs/tickets/artsem-review-epic.md#rule-1-never-commit-secrets-or-env-var-values).
- **Do not create or edit Prisma migrations by hand.** Change the
  schema, run `npx prisma migrate dev --name <name>`, and commit the
  generated SQL. Never delete or modify an existing migration folder.
  See [Rule 2](docs/tickets/artsem-review-epic.md#rule-2-do-not-create-or-modify-prisma-migrations-by-hand).

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      SHOPIFY ADMIN (iframe)                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Arcade Embedded App (React Router v7 + Polaris + Tailwind) │  │
│  │                                                             │  │
│  │  Onboarding → Category Grid → Product Type                 │  │
│  │  → Prompt Design → AI Design (PDP)                         │  │
│  │  → Pricing Config → Publish to Store                       │  │
│  │  Orders Dashboard (tabbed) · Edit Product                  │  │
│  └──────────┬──────────────────────┬──────────────────────────┘  │
└─────────────┼──────────────────────┼─────────────────────────────┘
              │                      │
         App Bridge            Session Token
         Navigation                Auth
              │                      │
   ┌──────────┴──────────┐   ┌──────┴──────────────────────────┐
   │ Shopify GraphQL     │   │ App Server (React Router SSR)    │
   │ Admin API (2026-01) │   │                                  │
   │ - productCreate     │   │  arcadeAuth.server.ts            │
   │ - variantsBulkCreate│   │   └ Firebase Admin → custom token│
   │ - stagedUploads     │   │   └ REST exchange → ID token     │
   │ - fulfillment       │   │   └ in-memory cache w/ expiry    │
   │ - orders            │   │                                  │
   └─────────────────────┘   │  arcadeApi.server.ts             │
                              │   └ POST /design-from-prompt     │
                              │   └ POST /batch/design-variants  │
                              │   └ auto-retry on 401            │
                              │                                  │
                              │  shopifyPublish.server.ts        │
                              │   └ staged upload → productCreate│
                              └──────────┬──────────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────┐
              │                          │                      │
   ┌──────────▼──────────┐   ┌──────────▼──────────┐   ┌──────▼──────────┐
   │ Arcade Backend API  │   │ Firebase / Firestore │   │ PostgreSQL      │
   │ - AI Design Engine  │   │ - Auth (ID tokens)   │   │ (Prisma ORM)    │
   │ - Order Routing     │   │ - designsFromPrompt  │   │ - Shop          │
   │ - Manufacturer Mgmt │   │   collection (real-  │   │ - ArcadeProduct │
   └─────────────────────┘   │   time onSnapshot)   │   │ - ProductVariant│
              │               └──────────────────────┘   │ - ArcadeOrder   │
   ┌──────────▼──────────┐                               │ - Session       │
   │ Manufacturer Network│            ┌─────────────────►│ - Categories    │
   │ - Fulfillment       │            │                  └─────────────────┘
   │ - Tracking          │            │
   └─────────────────────┘   ┌────────┴──────────┐
                              │ Shopify Webhooks  │
                              │ - app/uninstalled │
                              │ - app/scopes-update│
                              │ - GDPR (x3)      │
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
| **Session** | Shopify session storage (managed by `@shopify/shopify-app-session-storage-prisma`) |
| **Shop** | Shopify store connection — domain, `arcadeAccountId` (Firebase UID). No access token or email stored directly; auth is delegated to Firebase. |
| **ArcadeProduct** | Product designed in Arcade — design prompt, Firestore document ID, generation/variant IDs, AI imagery URLs, Shopify product GID, status (draft/publishing/active) |
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

| Screen | Route (URL) | File | Description |
|--------|-------------|------|-------------|
| Root redirect | `/` | `routes/_index.tsx` | Redirects to `/app` |
| Onboarding / Home | `/app` | `routes/app/home.tsx` | Welcome: value props, 3-step overview, "Get Started" CTA |
| Category Grid | `/app/categories` | `routes/app/categories/index.tsx` | Visual grid of 13 home textile category tiles |
| Product Type Selection | `/app/categories/:slug` | `routes/app/categories/$slug.tsx` | Product types within category — thumbnail, specs, base price, "Design" CTA |
| Prompt Design | `/app/design/prompt` | `routes/app/design/prompt.tsx` | Text area + structured chips (Category, Colors, Artist, Image upload) |
| Review & Pricing | `/app/design/:id/pricing` | `routes/app/design/$id.pricing.tsx` | Side-by-side preview, markup % control, per-variant pricing table |
| Publish Success | `/app/design/:id/success` | `routes/app/design/$id.success.tsx` | Success state with "View in Shopify Admin" + "Create Another Product" |
| Orders Dashboard | `/app/orders` | `routes/app/orders.tsx` | Tabbed (All/Unfulfilled/In Production/Shipped/Delivered), filterable, exportable |
| Auth callback | `/auth/*` | `routes/auth/$.tsx` | Shopify OAuth callback |
| Auth login | `/auth/login` | `routes/auth/login.tsx` | Shopify login bounce |

All `/app/*` routes share the layout in `routes/app/layout.tsx` which provides App Bridge, Polaris `AppProvider`, and `NavMenu`.

## Project Structure

```
arcade-shopify-app/
├── app/
│   ├── routes.ts                          # Explicit route config (code-based, not filesystem)
│   ├── root.tsx                           # HTML shell, fonts, Tailwind entry
│   ├── entry.server.tsx                   # SSR entry (ServerRouter)
│   ├── app.css                            # Tailwind v4 + custom design tokens
│   ├── shopify.server.ts                  # Shopify app config (API key, session storage)
│   ├── db.server.ts                       # Prisma client singleton
│   │
│   ├── routes/
│   │   ├── _index.tsx                     # Root redirect → /app
│   │   ├── app/
│   │   │   ├── layout.tsx                 # App shell: App Bridge + Polaris + NavMenu
│   │   │   ├── home.tsx                   # Onboarding / dashboard home
│   │   │   ├── orders.tsx                 # Orders dashboard (tabbed)
│   │   │   ├── categories/
│   │   │   │   ├── index.tsx              # Category browsing grid
│   │   │   │   └── $slug.tsx              # Product types within category
│   │   │   └── design/
│   │   │       ├── prompt.tsx             # Prompt design + AI generation
│   │   │       ├── $id.pricing.tsx        # Review & pricing config
│   │   │       └── $id.success.tsx        # Publish success screen
│   │   ├── auth/
│   │   │   ├── $.tsx                      # OAuth callback catch-all
│   │   │   ├── login.tsx                  # Login bounce
│   │   │   └── login.error.server.ts      # Login error helper
│   │   └── webhooks/
│   │       ├── app-uninstalled.tsx         # Shop cleanup on uninstall
│   │       ├── app-scopes-update.tsx       # Scope change handler
│   │       ├── customers-data-request.tsx  # GDPR data request
│   │       ├── customers-redact.tsx        # GDPR customer redact
│   │       └── shop-redact.tsx             # GDPR shop redact
│   │
│   ├── components/
│   │   ├── index.ts                       # Barrel export
│   │   ├── layout/
│   │   │   └── PageShell.tsx              # Consistent page heading + back nav
│   │   └── ui/
│   │       ├── BackButton.tsx
│   │       ├── ErrorBanner.tsx
│   │       ├── LoadingCard.tsx
│   │       ├── Spinner.tsx
│   │       └── StatusBadge.tsx
│   │
│   ├── services/
│   │   ├── arcade/
│   │   │   ├── arcadeApi.server.ts        # Arcade REST client (design generation, variants)
│   │   │   └── arcadeAuth.server.ts       # Firebase Admin → ID token minting + caching
│   │   ├── firebase/
│   │   │   └── firebase.ts                # Firebase client SDK (Firestore for real-time)
│   │   └── shopify/
│   │       └── shopifyPublish.server.ts   # Staged uploads + productCreate + variantsBulkCreate
│   │
│   ├── hooks/
│   │   └── useDesignGeneration.ts         # Firestore onSnapshot for design progress
│   │
│   ├── lib/
│   │   ├── env/
│   │   │   ├── env.server.ts              # Server env schema (Zod) — parsed at startup
│   │   │   └── client.env.ts              # Client env schema (VITE_ vars)
│   │   └── format.ts                      # Currency / number formatting helpers
│   │
│   └── types/
│       ├── arcade.ts                      # Design generation, variant, Firestore types
│       └── orders.ts                      # Order row, payment/fulfillment status types
│
├── prisma/
│   ├── schema.prisma                      # Full database schema
│   ├── migrations/                        # Prisma migrations
│   └── seed.ts                            # Category + product type seed data
│
├── docs/
│   └── adr/                               # Architecture decision records
│
├── public/                                # Static assets (logos)
├── shopify.app.toml                       # Shopify app configuration (dev)
├── shopify.app.arcadeai.toml              # Shopify app configuration (prod)
├── vite.config.ts                         # Vite + React Router + Tailwind plugins
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
# Fill in all required vars — the app validates them at startup via Zod
# and will print a clear error if any are missing.

# Run database migrations
npx prisma migrate dev

# Seed product categories (13 home textile categories)
npx prisma db seed

# Start development server (opens embedded app in Shopify Admin)
shopify app dev
```

### Environment Variables

All variables are validated at startup via Zod schemas in `app/lib/env/`.
Variables prefixed with `VITE_` are exposed to the browser bundle.

| Variable | Description |
|----------|------------|
| `SHOPIFY_API_KEY` | App API key from Shopify Partners |
| `SHOPIFY_API_SECRET` | App API secret |
| `SHOPIFY_APP_URL` | App URL (set by `shopify app dev`, or your production URL) |
| `SCOPES` | `read_products,write_products,read_orders,write_orders,read_fulfillments,write_fulfillments` |
| `DATABASE_URL` | PostgreSQL connection string |
| `ARCADE_API_URL` | Arcade backend REST API base URL |
| `ARCADE_API_KEY` | Arcade backend API key (sent as `X-Vercel-Authorization` header) |
| `VITE_FIREBASE_WEB_API_KEY` | Firebase Web API key (browser) |
| `VITE_FIREBASE_APP_ID` | Firebase app ID (browser) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain (browser) |
| `VITE_FIREBASE_DATABASE_URL` | Firebase Realtime DB URL (browser) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID (browser) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Admin SDK service account JSON (server-only, never exposed to browser) |
| `SHOP_CUSTOM_DOMAIN` | _(optional)_ Custom shop domain for non-standard myshopify.com domains |

## Milestones

| Milestone | Status | Focus |
|-----------|--------|-------|
| **M0: React Router rescaffold** | **Done** | Migrated from Remix to React Router v7, ported all loaders/actions/webhooks, explicit route config, Tailwind + shared components, Arcade API integration with Firebase auth, Zod env validation. See [ADR 0001](docs/adr/0001-remix-to-react-router.md). |
| **M1: Foundation** | Done | Scaffold, DB, OAuth, GDPR webhooks, designs, category seed data. |
| **M2: Core Flows** | In progress | Onboarding, category grid, prompt design, AI design PDP, variant selection, pricing config, publish to Shopify. |
| **M3: Order Pipeline** | Planned | Order webhooks, manufacturer routing, fulfillment tracking, orders dashboard. |
| **M4: Testing & Polish** | Planned | E2E testing, embedded performance, App Bridge compliance, analytics, edit product flow. |
| **M5: Beta & Submit** | Planned | Beta with existing users, bug fixes, App Store submission. |

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
