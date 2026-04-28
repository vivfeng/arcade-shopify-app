# Epic — Artsem's code review: Shopify app review findings

> **Source:** code review on `vivfeng/arcade-shopify-app` by Artsem.
> Covers architecture, security, and correctness of the embedded
> Shopify app.

---

## Review scope

| Area | What was reviewed |
|------|-------------------|
| App Bridge integration | `layout.tsx`, `entry.server.tsx`, `shopify.server.ts`, `login.tsx`, `$.tsx` |
| Data flow & auth | All loaders/actions across 8 route files, `arcadeAuth.server.ts`, `arcadeApi.server.ts` |
| Component architecture | `components/`, `PageShell`, `hooks/useDesignGeneration` |
| Shopify publish pipeline | `shopifyPublish.server.ts`, `$id.pricing.tsx` action |
| Webhook / GDPR compliance | All 5 webhook handlers |
| API boundaries | Arcade REST integration, Firebase Firestore real-time |
| Env & config | Zod schemas, `.env.example`, `shopify.app.toml` |

---

### 1. GDPR `customers/data_request` only logs to console · **P1 / Compliance**

**File:** `app/routes/webhooks/customers-data-request.tsx`.

**Current behavior:** Queries matching `arcadeOrder` rows, then
`console.log()`s them. Shopify's GDPR contract expects the app to
**deliver** the data to the merchant in a durable, auditable way (e.g.,
email, downloadable export, or a webhook callback with the payload).
Console logging on an ephemeral Vercel function is not durable and
will not survive App Store review.

**Fix:**
- For MVP, the simplest compliant approach: store the data request
  payload and matched records in a `GdprDataRequest` table with a TTL, and expose a route or email that the merchant
  can access. Alternatively, since data is minimal (order records
  only), return the data payload in the webhook response body if
  Shopify supports it.
- At minimum, log a structured JSON payload to a persistent logging
  service (not just `console.log`).

**Acceptance:**
- GDPR data request produces a durable, retrievable artifact
- App Store reviewer can verify the data is surfaced, not just logged

---

## Top 3 things to watch out for (defer, but flag)

### A. Firestore security rules are outside this repo

`useDesignGeneration` connects to Firestore's `designsFromPrompt`
collection via the **client SDK** with no Firebase Auth on the browser
session. Access control depends entirely on Firestore security rules
configured in the Arcade Firebase project. If those rules are
permissive (e.g., `allow read: if true`), any user who knows a
`firestoreDocumentId` can read another merchant's design results.

**Action:** Audit Firestore rules in the Arcade Firebase console.
Ensure `designsFromPrompt/{docId}` is restricted to the account that
created it, or add client-side Firebase Auth (sign in with the custom
token from `arcadeAuth.server.ts` and pass it to the client).

### B. Orders dashboard is entirely hardcoded mock data

`app/routes/app/orders.tsx` contains 12 `const ORDERS` rows with mock
data. The loader authenticates but returns in-memory mock data, not
DB or Shopify orders. This is fine for the current prototype/demo
phase, but:

- The 744-line file creates the impression of a production-ready
  screen — it should be clearly marked or gated so it's not mistaken
  for real functionality
- When wiring to real data (M3), the filter/sort/pagination logic
  in the loader needs to move to SQL queries, not in-memory array
  operations

### C. Arcade API `category_name` is hardcoded to "Decorative Pillows"

In `arcadeApi.server.ts` line 95, the design generation request always
sends `category_name: "Decorative Pillows"` regardless of which
category the merchant actually selected. The `prompt.tsx` action
passes `productTypeId` but never sends the category to the Arcade API.

**Risk:** When the app supports all 13 categories, generated designs
won't match the selected product type (e.g., selecting "Curtains"
still generates pillow designs).

**Fix:** Pass `category_name` through `DesignGenerationRequest` and
populate it from the product type's parent category in the action.

---

## Overall architectural direction

The codebase is on the right track. The M0 migration to React Router
v7 was the highest-leverage decision and it's landed cleanly — zero
Remix imports, explicit route config, proper App Bridge integration
with `Link` in `NavMenu`, correct `addDocumentResponseHeaders` in
`entry.server.tsx`, and session-scoped loaders throughout. The service
layer split (`services/arcade/`, `services/shopify/`,
`services/firebase/`) is a good foundation that will scale. The Arcade
auth flow (Firebase Admin → custom token → ID token exchange → cached)
is architecturally sound and handles token refresh + 401 retry
correctly. The Zod env validation and Tailwind design tokens show the
right level of engineering discipline for this stage.

The two structural risks to address before going further: (1) the IDOR
pattern in `$id.pricing.tsx` needs to become a codebase convention
("every route that takes a resource ID must verify it belongs to
`session.shop`") — consider a shared `requireProduct(params.id,
session.shop)` helper; and (2) the dual data source concern from the
original review (Prisma DB vs Arcade BE) is still present and will
compound as M2/M3 features land — the per-entity ownership matrix
from ADR 0001 B1 should be finalized before building more loaders
that read from local tables.

---

### Open questions not answered in this review

- **Firestore security rules:** Are `designsFromPrompt` documents
  read-restricted to the account that created them? Needs audit in
  the Firebase console.
- **Shopify product variant limits:** Shopify allows max 100 variants
  per product and max 3 options. The current `publishToShopify` uses
  Size × Fabric, which is 2 options (fine), but if the number of
  sizes × fabrics exceeds 100 the publish will fail silently with a
  Shopify `userErrors` array.
- **Webhook idempotency:** `app-uninstalled` and `shop-redact` handle
  P2025 (record not found) gracefully, but there's no deduplication
  by webhook delivery ID. If Shopify retries a webhook, the handler
  runs again. For `customers-redact` this is safe (redacting twice is
  idempotent), but for `shop-redact` the `$transaction` could fail
  mid-way on a retry if partial deletion already occurred.
- **GDPR data request delivery mechanism:** Needs a product decision —
  email, downloadable export, or merchant-facing dashboard?