# Shopify App: Project Breakdown

**Date:** April 13, 2026
**Project:** Shopify Partnership App ([Linear](https://linear.app/arcade-ai/project/shopify-partnership-app-d741d1114b76/overview))
**Contributors:** Vivian (product/build), Artsem (senior FE / architecture)

---

## Where we are

The app is roughly **65% complete**. The core flow -- onboarding, category browsing, design prompt, pricing, Shopify publish, and success confirmation -- is wired end-to-end. Auth, sessions, GDPR webhooks, and the Prisma schema (8 models) are solid.

Three critical routes are **completely missing**: the AI design detail page (`app.design.$id`), product edit (`app.products.$id`), and order detail (`app.orders.$id`). The orders dashboard exists but runs on mock data. There's no shared component library yet -- all UI is inline in route files.

**Tech stack:** React Router v7, Polaris, Prisma + PostgreSQL, Shopify GraphQL Admin API (v2026-01), Firebase Firestore (real-time design polling), Arcade backend API, Vercel.

---

## Ownership model

| Role | Scope |
|------|-------|
| **Vivian** | Continues building features she's started (design prompt, pricing, Arcade API integration). Ships fast with AI-assisted coding. |
| **Artsem** | Reviews Vivian's PRs for production quality. Architects and builds net-new routes/systems that haven't been started. Sets up component patterns for the team. |

---

## Workstreams

### WS1: Design PDP (Artsem owns, net-new)

The `app.design.$id` route does not exist yet. This is the screen users land on after AI generates their design. It's the most complex new page.

**What it needs:**
- Left panel: AI-generated image thumbnails (sourced from Firestore via `useDesignGeneration` hook)
- Right panel: product title, description, manufacturer attribution, size/fabric variant checkboxes
- Actions: "Edit Design" (calls Arcade regenerate endpoint), "Save as Draft" (writes to ArcadeProduct with DRAFT status), "Continue to Pricing" (navigates to `app.design.$id.pricing`)
- Loader: fetch ArcadeProduct by ID, scoped to current shop (multi-tenant)
- Action: upsert ArcadeProduct with selected variants

**Dependencies:**
- Arcade API Swagger confirmation for `/api/design-regenerate` and `/api/design-edit` endpoints (currently stubbed in `lib/arcadeApi.ts`)
- Firestore document shape is already mapped in the `useDesignGeneration` hook

**Estimated effort:** 5-7 days

---

### WS2: Orders system (Artsem owns, net-new + rewire)

Two pieces here: wiring real data into the existing orders dashboard, and building the missing order detail route.

**2a. Orders dashboard rewire (`app.orders.tsx`)**
- Replace the hardcoded `ORDERS` array with a Prisma query on `ArcadeOrder` scoped to the current shop
- Wire the tab filters (Unfulfilled / In Production / Shipped / Delivered) to `fulfillmentStatus` enum
- Add pagination (the table currently renders everything flat)

**2b. Order detail route (`app.orders.$id`, net-new)**
- Status timeline (visual progression: Unfulfilled -> In Production -> Shipped -> Delivered)
- Manufacturer info, ETA, tracking number/URL, carrier
- Line items with product images and variant details
- Loader: fetch ArcadeOrder by ID with related ArcadeProduct data, scoped to shop

**Estimated effort:** 4-5 days

---

### WS3: Product edit (Artsem owns, net-new)

The `app.products.$id` route does not exist. Post-publish, merchants need a way to edit their product listing.

**What it needs:**
- Edit title, rich-text description (with optional AI-assist for SEO copy)
- Status toggle (ACTIVE / DRAFT)
- Publishing channel selector (Online Store, POS, etc.)
- Sync back to Shopify via `productUpdate` GraphQL mutation
- Read-only sales summary (stretch goal -- pull from Shopify analytics API)

**Estimated effort:** 3-4 days

---

### WS4: Design prompt completion (Vivian owns, Artsem reviews)

The prompt screen (`app.design.prompt.tsx`) is ~80% done. Vivian continues here.

**Remaining work:**
- Confirm and integrate Arcade API endpoints for regenerate/edit once Swagger is finalized
- Image upload flow (reference images for the AI)
- Loading/progress states during async design generation
- Error handling (API failures, timeouts, malformed responses)
- Navigation: after generation completes, redirect to the new design PDP (WS1)

**Artsem's review focus:** State management patterns, error boundaries, multi-tenant safety in loaders/actions.

**Estimated effort:** 3-4 days

---

### WS5: Pricing and publish polish (Vivian owns, Artsem reviews)

The pricing screen (`app.design.$id.pricing.tsx`) is ~95% done. Mostly needs edge case handling.

**Remaining work:**
- Validate that markup % produces sane retail prices (guard against $0 or negative margins)
- Handle Shopify publish failures gracefully (retry logic, user-facing error)
- Test staged image uploads with various file sizes/formats
- Confirm variant creation matches Shopify's expected shape for size x fabric matrix

**Artsem's review focus:** GraphQL mutation error handling in `shopifyPublish.server.ts`, Shopify API rate limiting.

**Estimated effort:** 2-3 days

---

### WS6: Component extraction and code quality (Artsem owns)

No shared component library exists. All UI is inline in route files with raw style objects referencing design tokens from `lib/tokens.ts`.

**What to set up:**
- Create `app/components/` directory with shared Polaris-wrapped components
- Extract repeated patterns: category card, product row, pricing table row, status badge, page header
- Decide on styling approach: CSS modules, Polaris tokens only, or styled-components
- Add loading skeletons for async data (categories, designs, orders)
- Responsive layout fixes (category grid is currently hardcoded 4-column)

**Estimated effort:** 4-5 days (can be done incrementally alongside WS1-3)

---

### WS7: Testing and deployment prep (shared, after WS1-5)

**Testing:**
- Route-level integration tests for loaders and actions (especially multi-tenant shop scoping)
- Webhook idempotency tests (duplicate delivery handling)
- E2E: full journey from onboarding through design, publish, and order view

**Deployment:**
- API version lockstep check across `shopify.server.ts`, `shopify.app.toml`, and `shopify.app.arcadeai.toml` (ADR blocker B4)
- App Store submission checklist (Polaris compliance, privacy policy URL, no external redirects)
- Performance profiling in Shopify embedded iframe

**Estimated effort:** 5-7 days

---

## Suggested sequencing

```
Week 1-2:
  Artsem: WS1 (Design PDP) + starts WS6 (component patterns)
  Vivian: WS4 (prompt completion) + WS5 (pricing polish)

Week 2-3:
  Artsem: WS2 (orders system) + WS3 (product edit)
  Vivian: integration testing her flows + supports Artsem on Arcade API questions

Week 3-4:
  Both: WS7 (testing + deployment prep)
  Artsem: final WS6 pass (responsive, skeletons, polish)
```

**Total estimated timeline: ~4 weeks to feature-complete, assuming no major Arcade API blockers.**

---

## Open questions for Artsem

1. **Styling approach:** Should we go CSS modules, stick with inline Polaris tokens, or introduce something else? Current pattern is raw style objects in every route file.
2. **State management:** Is React Router's loader/action pattern sufficient, or do we need client-side state (Zustand, context) for cross-route data like the active design session?
3. **Testing framework:** What's the preferred setup? Vitest + Testing Library? Playwright for E2E?
4. **Component granularity:** How much should we extract now vs. defer? The app has ~13 routes total -- is a full design system overkill for MVP?
