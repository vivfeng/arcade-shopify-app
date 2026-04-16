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

## Top 3 things to fix this week

### 1. IDOR in pricing route — product not scoped to session shop · **P0 / Security**

**File:** `app/routes/app/design/$id.pricing.tsx`, loader (line 22)
and action (line 180).

**Current behavior:** Both the loader and the `publish` action load
`arcadeProduct` by `params.id` alone:

```ts
const product = await db.arcadeProduct.findUnique({
  where: { id: params.id },
  // ...
});
```

Any authenticated merchant who guesses or enumerates a product UUID
can view and publish another shop's product. This is an Insecure
Direct Object Reference (IDOR).

**Fix:** Add a `shop` filter to every query that uses `params.id`:

```ts
const { session } = await authenticate.admin(request);

const product = await db.arcadeProduct.findFirst({
  where: {
    id: params.id,
    shop: { domain: session.shop },
  },
  // ...
});

if (!product) throw new Response("Product not found", { status: 404 });
```

Apply the same pattern in the `update-price` intent — verify the
variant belongs to a product owned by `session.shop`.

**Acceptance:**
- Every DB read/write in `$id.pricing.tsx` is scoped by `session.shop`
- Manual test: two dev stores cannot cross-access each other's products
- Grep audit: no `arcadeProduct.findUnique({ where: { id: params.id } })`
  without a shop scope anywhere in the codebase

### 2. `prompt.tsx` action ignores intent — regenerate/edit are no-ops · **P0 / Correctness**

**File:** `app/routes/app/design/prompt.tsx`, action (line 42).

**Current behavior:** The action reads `intent` from form data but
never branches on it. Whether the UI submits `intent: "generate"`,
`"regenerate"`, or `"edit"`, the server always runs the "generate"
path and creates a brand new `arcadeProduct`. Additionally:

- `requestDesignRegenerate()` and `requestDesignEdit()` in
  `arcadeApi.server.ts` throw "not yet implemented"
- On Arcade API failure, a draft product is still created with
  `arcadeDocumentId: null`, stranding a DB row that
  `useDesignGeneration` can never resolve

**Fix (short-term):**
1. Gate the action on `intent` — for `"regenerate"` and `"edit"`,
   return a clear error (`{ error: "Regenerate is not yet available" }`)
   instead of silently creating a duplicate product
2. Move `db.arcadeProduct.create` inside the `try` block, after
   `requestDesignGeneration` succeeds — don't persist a draft if the
   API call failed
3. Disable or hide the Regenerate/Edit UI controls until the backend
   endpoints are confirmed

**Acceptance:**
- Submitting `intent: "regenerate"` or `"edit"` returns a user-facing
  error, not a silent duplicate
- No `arcadeProduct` rows exist with `arcadeDocumentId: null` after a
  failed generation
- UI reflects that regenerate/edit are not yet available

### 3. GDPR `customers/data_request` only logs to console · **P1 / Compliance**

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

## Repo rules

These are hard rules, not suggestions. They exist because we've
already been burned on both.

### Rule 1: Never commit secrets or env var values

`.env`, API keys, Firebase service account JSON, and any other
credential **must never be committed** — not even to a feature branch,
not even "temporarily". Git history is permanent; a force-push doesn't
erase it from clones and forks.

**What happened:** Staging env var values (API keys) were pushed to
the repo. Even after removal from the working tree, the values remain
in git history and must be treated as compromised — rotate the leaked
credentials rather than trying to rewrite history.

**Rules:**

1. **`.env` is gitignored.** Only `.env.example` is tracked, and it
   must contain **empty values** (e.g., `SHOPIFY_API_KEY=`), never
   real credentials. If you see a value after the `=` in
   `.env.example`, remove it.
2. **Never hardcode credentials in source files.** All secrets go
   through the Zod-validated env schemas in `app/lib/env/`. If a new
   secret is needed, add it to the schema and `.env.example` with an
   empty value.
3. **Before every commit, check `git diff --cached`** for anything
   that looks like a key, token, or connection string. If in doubt,
   don't commit the file.
4. **If a secret is accidentally committed:** immediately rotate the
   credential (revoke + reissue), then remove the value from the
   branch. Do not assume a force-push or history rewrite is sufficient
   — any clone or CI cache may already have the value.
5. **Files that must never be tracked:**
   - `.env` (any variant: `.env.local`, `.env.staging`,
     `.env.production`, `.env.development`)
   - `firebase-service-account*.json` or any JSON key file
   - `*.pem`, `*.key`, `*.p12` private key files

### Rule 2: Do not create or modify Prisma migrations by hand

Migrations are generated by Prisma and must be treated as immutable
artifacts. Manual edits to migration SQL — or deleting and recreating
migrations to "clean up" — causes schema drift between environments
and silent data loss.

**What happened:** Migration files were manually deleted and recreated
during development, causing the `init` migration to be rewritten
(`20260403211349_init` was dropped and replaced by
`20260413161208_init`). This orphaned the migration history on any
environment that had already applied the original. Downstream, this
manifests as Prisma refusing to migrate (`migration not found in
migration history`) or silently applying a destructive diff.

**Rules:**

1. **To change the schema:** edit `prisma/schema.prisma`, then run
   `npx prisma migrate dev --name descriptive-name`. Prisma generates
   the SQL — you don't write it.
2. **Never delete a migration folder** from `prisma/migrations/`.
   If a migration was applied to any environment (local, staging, CI),
   it is part of the permanent history. To undo it, create a new
   migration that reverses the change.
3. **Never edit a `migration.sql` file** after it's been committed.
   If the SQL is wrong, create a corrective migration on top.
4. **If you need to start fresh locally:** run
   `npx prisma migrate reset` — this drops and recreates the local DB
   from scratch using the full migration history. Do not delete
   migration folders to achieve the same effect.
5. **Before merging:** verify `npx prisma migrate deploy` succeeds
   against a clean database. If it fails, the migration history is
   broken and must be fixed before merge.

---

## Handoff note

### What context they need to know

1. **Route registration is manual.** New routes go in `app/routes.ts`
   with explicit `route()` / `layout()` / `prefix()` calls. The
   corresponding file goes in the matching nested folder under
   `app/routes/`. Forgetting either step is a silent 404.

2. **Arcade auth is Firebase Admin on the server, Firestore client
   SDK on the browser.** The server mints a custom token, exchanges
   it for an ID token via REST, and caches it. The browser Firestore
   connection is unauthenticated (relies on Firestore rules). If
   design generation ever needs writes from the client, Firebase Auth
   must be wired through.

3. **The `session.shop` scoping rule is critical.** Every loader and
   action that touches shop-specific data must resolve the shop via
   `session.shop` from `authenticate.admin(request)`, never by
   `params` or `findFirst()`. This is the multi-tenant correctness
   boundary. The README's "Ticket requirements" section codifies this.

4. **Env vars are validated at startup.** Adding a new env var means
   updating the Zod schema in `app/lib/env/env.server.ts` (or
   `client.env.ts` for `VITE_` vars) *and* `.env.example`. If you
   miss the schema, the app won't boot — by design.

5. **The Prisma schema has entities that may move to the Arcade BE.**
   `ProductCategory`, `ProductType`, and `Manufacturer` are locally
   seeded. `ArcadeProduct` and `ArcadeOrder` are locally managed.
   The ownership matrix (ADR 0001 B1) is still pending BE sign-off.
   Don't build features that assume these tables are permanent without
   checking with the BE owner.

6. **Three API functions are stubs.**
   `requestDesignRegenerate()`, `requestDesignEdit()`, and
   `pollDesignDocument()` all throw "not yet implemented". They're
   waiting on Swagger confirmation from the Arcade API team. The
   prompt UI has Regenerate and Edit buttons wired to these stubs —
   they submit form data but the server currently runs the default
   generate path (see finding #2 above).

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