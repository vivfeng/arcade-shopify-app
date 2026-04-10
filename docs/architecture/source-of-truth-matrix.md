# B1 — Source-of-truth matrix

> **Status:** Draft, awaiting BE-owner sign-off.
> **Blocks:** ADR 0001 M0 rescaffold (schema copy-forward).
> **Origin:** Artsem's review finding #4 and ADR 0001 blocker B1.

## Why this exists

`prisma/schema.prisma` today contains catalog, order, and manufacturer
tables that look a lot like a second Arcade backend. Arcade already
has a backend (env vars `ARCADE_API_URL` / `ARCADE_API_KEY` are
scaffolded in `.env.example` though no client code uses them yet).
Before we copy the schema forward into the React Router rescaffold
(M0) we need a per-entity decision on who owns each row and each
field — otherwise the duplication calcifies.

## Ownership modes

| Mode | Definition | Example |
|---|---|---|
| **App-owned (local)** | Must live in the Shopify app DB — framework or identity-binding requires it. | `Session`, `Shop` |
| **BE-owned (remote)** | Arcade BE is source of truth. App reads via API, never persists locally. | `ProductCategory`, `Manufacturer` |
| **BE-owned + local mirror** | BE is source of truth. App keeps a thin local row for Shopify-side fields (`shopifyProductGid`) and for rendering lists without a round-trip. BE id is the primary key; local-only fields are additive. | `ArcadeProduct`, `ArcadeOrder` |
| **Shopify-owned (cache)** | Data only Shopify produces (product GIDs, order ids, webhook payloads). We store references but Shopify is canonical. | Fields like `shopifyProductGid`, `shopifyOrderId` |

## Quick reference matrix

| Entity | Today | Proposed owner | Keep in Prisma? |
|---|---|---|---|
| `Session` | App DB | **App DB (required)** | Yes |
| `Shop` | App DB | **App DB (required)** | Yes |
| `ProductCategory` | App DB | **BE-owned** | No — delete from schema |
| `ProductType` | App DB | **BE-owned** | No — delete from schema |
| `Manufacturer` | App DB | **BE-owned** | No — delete from schema |
| `ArcadeProduct` | App DB | **BE-owned + mirror** | Yes — slimmed down |
| `ProductVariant` | App DB | **BE-owned + mirror** | Yes — slimmed down |
| `ArcadeOrder` | App DB | **BE-owned + mirror** | Yes — slimmed down |

---

## Per-entity analysis

### 1. Session — App DB (required)

**Why:** `@shopify/shopify-app-session-storage-prisma` reads/writes
this model directly. No choice.

**Current call sites:**
- `webhooks.app.uninstalled.tsx` — `db.session.deleteMany({ where: { shop } })`

**Fields:** all framework-mandated. No changes.

**Decision needed:** none.

---

### 2. Shop — App DB (required)

**Why:** binds `shopify_domain` → `access_token` → `arcade_account_id`.
This is the identity bridge between Shopify and Arcade. Must be local
because the Shopify session token resolves to a `shop` domain, and we
need to look up credentials and the linked Arcade account without a
round-trip to BE.

**Current call sites:**
- `app.tsx` loader — `db.shop.upsert()` on every authenticated request
  (provisions the shop row and refreshes the access token).
- `app._index.tsx` — reads `onboardingComplete`.
- `app.design.prompt.tsx` — `db.shop.findUnique({ domain: session.shop })`
  to scope product creation.
- `webhooks.shop.redact.tsx` — deletes the shop and all its children.

**Current fields and ownership:**

| Field | Owner | Notes |
|---|---|---|
| `domain` | Shopify | From `session.shop`. Immutable once set. |
| `accessToken` | Shopify | Offline token, refreshed on re-auth. |
| `arcadeAccountId` | Arcade BE | Set during account provisioning. |
| `email`, `name` | Shopify | Merchant identity. |
| `onboardingComplete` | App | Local UI state. |
| `installedAt`, `uninstalledAt` | App | Local lifecycle tracking. |

**Decision needed:** none — stays as-is.

**Open question:** should `arcadeAccountId` be populated by a BE
call during install (app calls `POST /accounts/provision`), or does
BE populate it via a callback? This affects the install flow.

---

### 3. ProductCategory — BE-owned (delete from schema)

**Why:** catalog reference data. Categories are global across the
Arcade network, not per-merchant. The app currently seeds them from
`prisma/seed.ts` — but in production they should come from the BE
catalog API so the app automatically reflects new categories when
Arcade adds them.

**Current call sites:**
- `app.categories._index.tsx` — `db.productCategory.findMany()`
  (renders the category grid).
- `app.categories.$slug.tsx` — `db.productCategory.findUnique()`
  (renders product types within a category).
- `prisma/seed.ts` — `db.productCategory.upsert()` (seeds 13 home
  textile categories).

**Proposed migration:**
- Delete `ProductCategory` from `schema.prisma`.
- Replace `db.productCategory.findMany()` with a BE API call:
  `GET /api/catalog/categories`.
- Cache the response in memory or via HTTP-cache headers (categories
  change infrequently — a 5-minute TTL is fine).
- Seed data (`prisma/seed.ts`) is no longer needed for categories;
  the BE catalog becomes the source.

**BE API contract needed:**

```
GET /api/catalog/categories
→ { categories: [{ id, name, slug, description, imageUrl, sortOrder }] }
```

---

### 4. ProductType — BE-owned (delete from schema)

**Why:** same rationale as `ProductCategory`. Product types include
`specs`, `basePrice`, `sizeOptions`, `fabricOptions`, `manufacturerId`
— all catalog master data that Arcade manages across its manufacturer
network.

**Current call sites:**
- `app.categories.$slug.tsx` — loaded via the category relation.
- `app.design.prompt.tsx` — `db.productType.findUnique({ slug })`
  (loads the product type for the prompt screen).
- `prisma/seed.ts` — `db.productType.upsert()`.

**Proposed migration:**
- Delete `ProductType` from `schema.prisma`.
- Fetch via BE API — either nested under the category endpoint or
  as a separate call:
  `GET /api/catalog/categories/:slug/product-types` or
  `GET /api/catalog/product-types/:slug`.
- Same caching strategy as categories.

**BE API contract needed:**

```
GET /api/catalog/product-types/:slug
→ { id, name, slug, specs, basePrice, sizeOptions, fabricOptions,
     imageUrl, categoryId, manufacturerId }
```

---

### 5. Manufacturer — BE-owned (delete from schema)

**Why:** pure reference data. The manufacturer network is an Arcade
concept, not a per-merchant one. No route in the app currently reads
a manufacturer directly — the only reference is via
`ProductType.manufacturerId`.

**Current call sites:**
- `prisma/seed.ts` — `db.manufacturer.upsert()` (seeds one demo
  manufacturer).
- No route reads `Manufacturer` directly.

**Proposed migration:**
- Delete `Manufacturer` from `schema.prisma`.
- Manufacturer data comes through as a nested field on `ProductType`
  from the BE catalog API (e.g. `manufacturer: { id, name }`).
- If the orders dashboard needs to show manufacturer info, fetch it
  from BE at render time.

---

### 6. ArcadeProduct — BE-owned + local mirror

**Why:** the product's canonical state (design, AI imagery, title,
description, pricing) lives in the Arcade backend. But the Shopify
app needs to:
- Store `shopifyProductGid` after calling Shopify's `productCreate`.
- Track `status` locally for the publish state machine
  (DRAFT → PUBLISHING → ACTIVE — see ADR blocker B2).
- Render the merchant's product list without a round-trip to BE.

**Current call sites:**
- `app.design.prompt.tsx` action — `db.arcadeProduct.create()`.
- `app.design.$id.success.tsx` — `db.arcadeProduct.findUnique()`.
- `webhooks.shop.redact.tsx` — `db.arcadeProduct.deleteMany()`.

**Current fields — proposed ownership split:**

| Field | Current | Proposed owner | Keep locally? |
|---|---|---|---|
| `id` | App (cuid) | **BE** (BE generates the id) | Yes — as `beProductId` foreign key |
| `designPrompt` | App | **BE** | No — BE stores the prompt |
| `imageUrls` | App | **BE** | No — BE stores AI imagery URLs |
| `shopifyProductGid` | App | **App (local)** | Yes — only the app knows this |
| `status` | App | **App (local)** | Yes — publish state machine is app-side |
| `title`, `description` | App | **BE** | No — catalog data |
| `shopId` | App | **App (local)** | Yes — scopes to the merchant |
| `productTypeId` | App | **BE** | No — replaced by `beProductTypeId` on the BE record |

**Proposed slimmed-down mirror schema:**

```prisma
model ArcadeProduct {
  id                String        @id  // BE-generated id
  shopifyProductGid String?       // set after Shopify productCreate
  status            ProductStatus @default(DRAFT)
  publishError      String?       // set on publish failure
  shopId            String
  shop              Shop          @relation(...)
  variants          ProductVariant[]
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
}
```

Everything else (prompt, images, title, description, product type)
is fetched from BE at render time via `GET /api/products/:id`.

**BE API contracts needed:**

```
POST /api/products
  body: { shopId, productTypeId, designPrompt, colors?, artist? }
  → { id, designPrompt, imageUrls, title, description, productType, ... }

GET /api/products/:id
  → { id, designPrompt, imageUrls, title, description, productType, status, ... }

GET /api/shops/:shopId/products
  → { products: [...] }  (for list views)
```

---

### 7. ProductVariant — BE-owned + local mirror

**Why:** same pattern as `ArcadeProduct`. Variant definitions
(size, fabric, product cost) are catalog data from BE. But
`retailPrice` and `markupPercent` are merchant-set values that may
need to live locally or in BE under the merchant's account.

**Current call sites:**
- `webhooks.shop.redact.tsx` — `db.productVariant.deleteMany()`.
- No route currently creates or reads variants (screens not built yet).

**Current fields — proposed ownership split:**

| Field | Proposed owner | Keep locally? |
|---|---|---|
| `id` | **BE** | Yes — as mirror key |
| `size`, `fabric` | **BE** (catalog) | No |
| `productCost` | **BE** (manufacturer pricing) | No |
| `retailPrice` | **Merchant via BE** | Depends — see open question |
| `markupPercent` | **Merchant via BE** | Depends — see open question |
| `arcadeProductId` | **BE** | Yes — local FK to mirror |

**Open question:** are `retailPrice` and `markupPercent` stored in BE
under the merchant's account, or is this purely app-side? If BE owns
pricing, the mirror is read-only. If the app owns retail pricing, we
keep those two fields locally.

---

### 8. ArcadeOrder — BE-owned + local mirror

**Why:** Shopify's `orders/create` webhook lands in the app. The app
forwards to BE for manufacturer routing and fulfillment. BE becomes
source of truth for fulfillment state, tracking, and manufacturer
assignment. The app keeps a local mirror for:
- The Orders dashboard (renders without round-tripping to BE).
- GDPR compliance (`customers/data_request` and `customers/redact`
  need to find and redact customer PII from local storage).

**Current call sites:**
- `webhooks.customers.data-request.tsx` — `db.arcadeOrder.findMany()`
  (returns stored customer data for GDPR).
- `webhooks.customers.redact.tsx` — `db.arcadeOrder.updateMany()`
  (redacts customer name/email).
- `webhooks.shop.redact.tsx` — `db.arcadeOrder.deleteMany()`.
- `app.orders.tsx` — currently renders mock data, not DB reads.

**Current fields — proposed ownership split:**

| Field | Proposed owner | Keep locally? |
|---|---|---|
| `id` | **BE** | Yes — mirror key |
| `shopifyOrderId`, `shopifyOrderNumber` | **Shopify (cache)** | Yes — from webhook payload |
| `customerName`, `customerEmail` | **Shopify (cache)** | Yes — needed for GDPR redaction |
| `totalPrice` | **Shopify (cache)** | Yes |
| `paymentStatus` | **BE** | Yes — mirror (BE updates after charge) |
| `fulfillmentStatus` | **BE** | Yes — mirror (BE updates via manufacturer) |
| `trackingNumber`, `trackingUrl`, `carrierName` | **BE** | Yes — mirror (BE populates from manufacturer) |
| `shopId` | **App** | Yes |
| `manufacturerId` | **BE** | No — app doesn't need this locally |

**Data flow:**

```
Shopify orders/create webhook
  → app receives payload
  → app creates local ArcadeOrder mirror (Shopify fields only)
  → app forwards to BE: POST /api/orders { shopifyOrderId, items, ... }
  → BE routes to manufacturer, returns beOrderId
  → app stores beOrderId as the mirror's id

BE updates fulfillment status (via callback or polling):
  → app receives status update
  → app updates local mirror (fulfillmentStatus, tracking*)
  → app syncs tracking to Shopify via Fulfillment API
```

---

## Proposed Prisma schema after ratification

Only `Session`, `Shop`, and the three mirror tables survive. Catalog
entities (`ProductCategory`, `ProductType`, `Manufacturer`) are
deleted entirely — data comes from the BE API.

```prisma
// ─── Framework-required ───
model Session { /* unchanged */ }

// ─── App-owned ───
model Shop {
  id                 String    @id @default(cuid())
  domain             String    @unique
  accessToken        String
  arcadeAccountId    String?
  email              String?
  name               String?
  onboardingComplete Boolean   @default(false)
  installedAt        DateTime  @default(now())
  uninstalledAt      DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  products ArcadeProduct[]
  orders   ArcadeOrder[]
}

// ─── BE-owned mirrors ───
enum ProductStatus { DRAFT; PUBLISHING; ACTIVE }

model ArcadeProduct {
  id                String        @id  // BE-generated
  shopifyProductGid String?
  status            ProductStatus @default(DRAFT)
  publishError      String?
  shopId            String
  shop              Shop          @relation(...)
  variants          ProductVariant[]
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  @@index([shopId])
}

model ProductVariant {
  id              String  @id  // BE-generated
  retailPrice     Decimal @db.Decimal(10, 2)  // if app-owned
  markupPercent   Decimal @db.Decimal(5, 2)   // if app-owned
  arcadeProductId String
  arcadeProduct   ArcadeProduct @relation(...)
  @@index([arcadeProductId])
}

model ArcadeOrder {
  id                 String            @id  // BE-generated
  shopifyOrderId     String
  shopifyOrderNumber String?
  customerName       String?
  customerEmail      String?
  totalPrice         Decimal           @db.Decimal(10, 2)
  paymentStatus      PaymentStatus     @default(PENDING)
  fulfillmentStatus  FulfillmentStatus @default(UNFULFILLED)
  trackingNumber     String?
  trackingUrl        String?
  carrierName        String?
  shopId             String
  shop               Shop              @relation(...)
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  @@index([shopId])
  @@index([shopifyOrderId])
}
```

---

## Open questions for BE team

### Catalog API
1. **Is there a catalog API today?** If not, when? The rescaffold
   can't drop `ProductCategory` / `ProductType` / `Manufacturer`
   from Prisma until there's a read endpoint to replace them.
2. **Caching strategy** — can the app set a 5-minute in-memory TTL
   on catalog responses, or does BE provide `Cache-Control` headers?
3. **Pagination** — the category grid is flat (13 items); product
   types per category are small (~4 per category). Is pagination
   needed, or can responses be unpaginated?

### Identity & IDs
4. **What's the ID convention?** Current Prisma uses `cuid()`. If BE
   uses UUIDs, the mirror rows key on BE-generated ids. We need to
   know the format before M0 writes the migration.
5. **Account provisioning** — does the app call
   `POST /api/accounts/provision` during Shopify install, or does BE
   detect the install via a separate channel?

### Product lifecycle
6. **Publish contract** — does the app POST the designed product to
   BE and get back an id, or does BE create the product (e.g. after
   AI generation) and the app just references it?
7. **Who calls Shopify `productCreate`?** The app (since it has the
   Shopify access token) or BE (via a delegated token)?
8. **Retry / idempotency for publish** — if the app crashes between
   creating the Shopify product and updating the mirror, how do we
   reconcile? Proposed: a `PUBLISHING` intermediate state (ADR B2).

### Orders
9. **Order forwarding** — does the app call BE synchronously from
   the `orders/create` webhook handler, or push to a queue?
10. **Fulfillment status updates** — does BE push updates to the app
    (webhook callback), or does the app poll BE?
11. **Idempotency key** — `shopifyOrderId` is unique per order.
    Sufficient as the idempotency key, or does BE want its own?

### GDPR
12. **Redaction forwarding** — `customers/redact` and `shop/redact`
    currently delete from the app DB. If order data moves to BE, the
    app needs to forward the redaction. Does BE have an endpoint for
    that? What's the SLA (Shopify gives 48h)?

## What "ratified" means

BE owner marks each of the 8 entity rows in the quick reference
matrix as **accepted** or **revised** and commits changes back to
this file. Open questions are answered or explicitly deferred with a
target date. After that:

1. M0 copies only `Session`, `Shop`, and the three mirror tables
   into the new Prisma schema.
2. Catalog entities are replaced with BE API calls + a thin
   `arcadeApi.server.ts` client module.
3. Each mirror table uses BE-generated ids as primary keys.
4. Seed data for categories/types/manufacturers is deleted.

## Next steps

- [ ] Share this file with BE owner (Slack thread or ticket link here).
- [ ] BE review, per-row accepted/revised.
- [ ] Answer or defer each open question with a target date.
- [ ] Once ratified, draft `arcadeApi.server.ts` — the client module
      that replaces direct Prisma reads on catalog entities.
- [ ] Write the Prisma migration that drops catalog tables and slims
      the mirror tables.
- [ ] Update ADR 0001 B1 to mark as ratified.
- [ ] Unblock M0.
