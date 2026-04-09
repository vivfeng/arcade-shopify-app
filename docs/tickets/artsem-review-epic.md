# Epic — Artsem's suggestions: Shopify app review findings

> **Source:** code review on `vivfeng/arcade-shopify-app` by Artsem.
> Covers architecture, security, and correctness of the embedded
> Shopify app.
>
> **Forward-going direction:** see
> [`docs/adr/0001-remix-to-react-router.md`](../adr/0001-remix-to-react-router.md)
> — accepted and in force. This epic exists because the review surfaced
> both the decision to migrate (ADR) *and* a set of discrete bugs that
> shouldn't wait for the rescaffold.

---

## HIGH severity

### 1. Stop investing in the Remix stack — migrate to React Router

Repository still uses `@shopify/shopify-app-remix`. Shopify's current
docs and templates recommend `@shopify/shopify-app-react-router`, and
Remix itself encourages teams to migrate. Team context: most of the
team is more comfortable with React (the customer-facing Next.js app
is already React). App surface is still small, so this is the cheapest
moment to switch the scaffold.

**Tracking:** [ADR 0001](../adr/0001-remix-to-react-router.md).
Includes file-by-file port mapping, risk register, and the ten
acceptance criteria that define "migration complete".

### 2. 35 `npm audit` vulnerabilities

App is new but already ships ~35 vulnerabilities, mostly transitive
via the older Remix/Vite dependency tree. React Router template has
these resolved already — rescaffold is expected to drop findings to
near-zero. Explicit acceptance criterion in ADR 0001:
`npm audit --production` reports zero high/critical.

### 3. Main creation flow is not wired through

`app/routes/app.design.prompt.tsx` navigates to `/app/design/:id`, and
`app/routes/app.design.$id.success.tsx` redirects to
`/app/design/:id/pricing`, but neither route file exists in the repo.
The happy path documented in `README.md` is materially ahead of what's
shipped. A merchant who follows "describe your design → generate"
lands on a 404.

**Addressed in code:** see subticket — interim "toast-and-stay" fix
stops the 404 without introducing new Remix files. The real PDP and
pricing screens land in M0 as React Router routes, not as Remix stubs.

### 4. Arcade app DB is turning into a second backend

`prisma/schema.prisma` includes local copies of `ProductCategory`,
`ProductType`, `Manufacturer`, `ArcadeProduct`, `ProductVariant`, and
`ArcadeOrder`. Loaders/actions read these tables directly. Since
Arcade already has a real backend and DB, this is the biggest
architectural risk: two sources of truth for catalog, pricing,
fulfillment, and product state.

**Tracking:** proposed per-entity ownership matrix captured in
ADR 0001 blocker **B1**. The matrix is a starting point for the BE
conversation, not the decision. Must be ratified with the BE owner
before the rescaffold copies `schema.prisma` forward.

### 5. Multi-merchant correctness bug

Product creation does not use the authenticated shop. The action in
`app/routes/app.design.prompt.tsx` uses:

```ts
const shop = await db.shop.findFirst({
  where: { domain: { not: "" } },
  select: { id: true },
});
```

In a multi-store install, this attaches new products to whichever
shop row sorts first. Must be
`findUnique({ where: { domain: session.shop } })`.

**Tracking:** ADR 0001 blocker **B3**. Addressed in code via the
subticket below — and enshrined as a repo-wide rule in the README's
"Ticket requirements" section.

---

## MEDIUM severity

### 6. Embedded navigation uses a Shopify anti-pattern

`app/routes/app.tsx` NavMenu uses raw `<a>` tags:

```tsx
<NavMenu>
  <a href="/app" rel="home">Home</a>
  <a href="/app/categories">Create Product</a>
  <a href="/app/orders">Orders</a>
</NavMenu>
```

Shopify's React Router template explicitly warns against this. Inside
an embedded iframe, anchor navigation drops the session token and
triggers a top-frame reload — the app then loses its session and
re-auths. Must use the framework `Link`.

**Addressed in code:** see subticket.

### 7. Config and documentation drift

Four sources disagreed or were stale at review time:

| File | Value / state |
|---|---|
| `README.md` | Called Remix "the official Shopify template" (**fixed** on `claude/address-review-findings-uSZrc`) |
| `app/shopify.server.ts` | `ApiVersion.January25` |
| `shopify.app.toml` | `api_version = "2025-01"` |
| `shopify.app.arcadeai.toml` | `api_version = "2026-07"` (not a real release of `@shopify/shopify-api@13`) |

Next person can't tell which config is authoritative. Align to a
single version and add lockstep comments pointing at the ADR.

**Tracking:** ADR 0001 blocker **B4**. Will be resolved as part of the
rescaffold — aligning mid-flight would introduce churn in a tree we're
about to replace.

---

## Documentation to produce next

Artsem's follow-up list. Each is its own child issue under this epic.

- [ ] **Source-of-truth matrix** — Shopify vs Shopify app DB vs Arcade
      BE, per entity. Draft inline in ADR 0001 blocker B1; needs BE
      sign-off to become canonical.
- [ ] **Install/auth model** — offline token storage, session strategy
      (`unstable_newEmbeddedAuthStrategy`), account-linking rules.
- [ ] **Publish contract** — how an `ArcadeProduct` becomes a Shopify
      product: variant limits, metafields/metaobjects, reconciliation.
      Publish state machine draft in ADR 0001 blocker B2.
- [ ] **Webhook pipeline** — what lands here, what gets queued, what
      gets forwarded to Arcade BE, idempotency rules.
- [ ] **Migration plan: Remix → React Router** — what ports directly
      vs. rebuilt. **Drafted** in ADR 0001. Artsem's preference:
      implement from scratch against official Shopify React Router
      docs rather than in-place swap. ADR ratifies that choice.
- [ ] **Config canonicity** — which toml is authoritative per
      environment, current API version, lockstep rule. Addressed as
      ADR 0001 blocker B4.

---

## Status on branch `claude/address-review-findings-uSZrc`

- ADR 0001 written, expanded with repo-specific detail, and codified
  as a forward-going policy (4 rules on what new work can and cannot
  do while the Remix tree still exists).
- README updated: tech stack references React Router as the target,
  "Ticket requirements" section added, M0 rescaffold milestone added
  as a prerequisite for M2.
- Inline `TODO(AII-826)` in `app/routes/app.design.prompt.tsx`
  annotated with the React Router requirement.

---

# Subticket — Re-land HIGH-severity reverted code fixes

> **Parent epic:** Artsem's suggestions — Shopify app review findings
>
> Three HIGH items (items 3, 5, 6 above) were originally fixed in
> commits `a930ff4`, `4240646`, `7cbc750` on
> `claude/address-review-findings-uSZrc`, then reverted (`3965a8e`,
> `ffa5ed1`, `bd80c16`) so the branch could focus on the ADR. These
> are surgical bug fixes permitted by ADR 0001 policy rule 3
> ("bug fixes on existing Remix files are allowed, must stay minimal")
> and should land before the rescaffold begins.

## Fix 1 — Multi-tenant `findFirst()` in product creation · **P0**

**File:** `app/routes/app.design.prompt.tsx`, action handler.

**Current behavior:** resolves the shop via
`db.shop.findFirst({ where: { domain: { not: "" } } })`. In any
multi-store install, new products attach to whichever shop row sorts
first.

**Fix:**

```ts
const { session } = await authenticate.admin(request);
// ...
const shop = await db.shop.findUnique({
  where: { domain: session.shop },
  select: { id: true },
});
```

**Acceptance:**

- No `db.shop.findFirst(...)` call remains anywhere in the codebase.
- Every loader/action that needs a shop resolves it via `session.shop`.
- Grep guard in CI (or an ESLint rule if it's cheap) fails the build
  if `shop.findFirst` is reintroduced.

## Fix 2 — Missing `/app/design/:id` and `/app/design/:id/pricing` · **P0**

**Current behavior:** `app.design.prompt.tsx` navigates to
`/app/design/:id` after draft creation, and
`app.design.$id.success.tsx` redirects to `/app/design/:id/pricing`.
Neither route file exists. Happy path 404s.

**Fix (interim, ADR-policy-safe):** change
`app/routes/app.design.prompt.tsx` to show an in-place "Draft saved"
confirmation on success with a link back to `/app/categories`. No new
files, no new Remix imports. Defers the full PDP + pricing screens to
M0, where they land as React Router routes.

**Why not stub the routes now:** stubbing `$id.tsx`, `$id._index.tsx`,
and `$id.pricing.tsx` against Remix adds three new Remix files right
before the rescaffold, which violates ADR 0001 policy rule 1 ("no new
`@remix-run/*` imports"). The stubs would be deleted during M0 anyway.

**Acceptance:**

- Clicking "Generate" on the prompt page no longer triggers a 404.
- The confirmation state surfaces the draft id and a "Back to
  categories" link.
- No new files under `app/routes/`.
- `app.design.$id.success.tsx` remains on the tree but is orphaned
  until M0 — noted in the ADR port mapping.

## Fix 3 — `NavMenu` raw `<a>` tags · **P1**

**File:** `app/routes/app.tsx`.

**Current behavior:**

```tsx
<NavMenu>
  <a href="/app" rel="home">Home</a>
  <a href="/app/categories">Create Product</a>
  <a href="/app/orders">Orders</a>
</NavMenu>
```

Inside the Shopify admin iframe, anchor navigation drops the session
token and causes a top-frame reload.

**Fix:** swap for `Link` from `@remix-run/react`.

```tsx
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
// ...
<NavMenu>
  <Link to="/app" rel="home">Home</Link>
  <Link to="/app/categories">Create Product</Link>
  <Link to="/app/orders">Orders</Link>
</NavMenu>
```

**Policy note:** edits an existing Remix file, adds no new files, and
introduces a single additional named import (`Link`) from an already-
imported module. Qualifies as a "surgical bug fix" under ADR 0001
rule 3.

**Acceptance:**

- No `<a href>` inside `NavMenu` anywhere in the repo.
- Session token survives cross-section navigation in the embedded
  iframe.
- A repro-driven manual smoke test with two browser tabs to two
  different dev stores confirms no session bleed between them.

---

## Follow-ups not in this subticket

The remaining review findings are either already documented or
deferred to M0:

- Config drift (finding 7) — resolved by ADR 0001 blocker B4 at
  rescaffold time. No interim fix.
- Second-backend DB concern (finding 4) — blocked on the B1 matrix
  conversation with BE; no code change until that lands.
- `ArcadeProduct.status` needs `PUBLISHING` — ADR 0001 blocker B2,
  shipped as part of M0's Prisma copy.
