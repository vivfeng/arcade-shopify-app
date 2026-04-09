# ADR 0001 — Migrate scaffold from Shopify Remix to React Router

## Status

Accepted and in force.

**Policy for all new work from 2026-04-09 onward:**

1. **No new Remix imports.** No new code may introduce imports from
   `@remix-run/*` or `@shopify/shopify-app-remix`. Every new loader,
   action, component, hook, or route is written against React Router
   v7 / `@shopify/shopify-app-react-router` conventions. If the file
   you are touching is not yet migrated, match the local style, but
   do not *spread* Remix imports to new files.
2. **New tickets are scoped against React Router.** When a ticket is
   written against this repo, the acceptance criteria and code snippets
   must reference React Router — not Remix — even while the rescaffold
   is still in flight. A ticket that says "add a Remix loader for X"
   should be rejected at triage and rewritten.
3. **Bug fixes on existing Remix files** are allowed (we cannot
   indefinitely ship broken code while waiting for the port), but the
   fix must be minimal — import-swap or new imports only if absolutely
   required. Anything larger gets rolled into the rescaffold instead.
4. **The rescaffold is the migration vehicle.** There is no in-place
   upgrade. See "Decision" and "Migration checklist" below.

Migration to be executed before we add significant new surface area.

## Context

This repo was scaffolded with [`@shopify/shopify-app-remix`](https://www.npmjs.com/package/@shopify/shopify-app-remix),
which was the official Shopify template at the time. Shopify has since
moved its official guidance and scaffolds to
[`@shopify/shopify-app-react-router`](https://www.npmjs.com/package/@shopify/shopify-app-react-router),
and Remix itself
[encourages teams to migrate to React Router v7](https://remix.run/blog/incremental-path-to-react-19).

Three things motivate the switch for us specifically:

1. **Team fit.** The rest of our app surface (customer-facing Next.js) is
   React-first. Most of the team is comfortable with React patterns,
   less so with Remix-specific conventions. React Router sits closer to
   plain React.
2. **Supply-chain hygiene.** `npm audit` on the current scaffold reports
   ~35 vulnerabilities, most transitively via the older Remix/Vite
   dependency tree that the React Router template has already resolved.
   A fresh scaffold clears those in one pass instead of a hand-written
   audit per finding.
3. **Documentation drift.** Shopify's docs site now defaults every code
   sample to React Router. Every time we look something up, we have to
   mentally translate. Over a year of maintenance that cost adds up.

We're still small enough that the cost of switching is low. Concretely,
the Remix surface area in this repo today is:

- **22 files** import from `@remix-run/node`, `@remix-run/react`, or
  `@remix-run/serve`.
- **2 files** import `@shopify/shopify-app-remix` directly
  (`app/shopify.server.ts`, `app/routes/app.tsx`, plus the
  `error.server.ts` helper under `auth.login/`).
- **1 file** uses the Remix server-render entrypoint (`app/entry.server.tsx`).
- **1 file** uses the `flat-routes` convention via `@remix-run/fs-routes`
  (`app/routes.ts`).
- **~7 business routes** under `app/routes/app.*.tsx`, plus 5 webhook
  routes and 2 auth routes.

All of the above is mechanical rework, not design work. The bulk of
what we've built — Prisma models, Polaris UIs, the Shopify auth story,
the webhook handlers — is framework-agnostic.

## Decision

We will migrate the Shopify app to `@shopify/shopify-app-react-router`.

**Approach:** scaffold a new app using the React Router template and
port routes/components into it, rather than attempting an in-place
dependency swap. Rationale:

- An in-place swap means juggling two framework conventions inside the
  same tree until every file is migrated. Code review gets hard.
- The React Router template ships a curated set of dependencies with a
  clean `npm audit`. Swapping in place inherits the old lockfile,
  meaning we would also need to hand-fix each audit finding — exactly
  the work the rescaffold is supposed to avoid.
- The rescaffold lets us re-evaluate the things we built quickly during
  the initial spike (inline styles, the second-backend Prisma tables,
  the publish state machine — see "Pre-migration blockers" below)
  without gating the port on those decisions.

### Port mapping (current → React Router target)

| Current file | Action | Target | Notes |
|---|---|---|---|
| `app/shopify.server.ts` | **Rewrite imports** | `app/shopify.server.ts` | Swap `@shopify/shopify-app-remix/server` → `@shopify/shopify-app-react-router/server`. `ApiVersion` pin stays unless the template ships a newer one (if so, update both toml files in lockstep — see config-drift section). |
| `app/db.server.ts` | **1:1 copy** | `app/db.server.ts` | No framework dependency. |
| `app/entry.server.tsx` | **Delete, use template's** | — | React Router v7 provides a drop-in SSR entry. Don't port the `RemixServer` JSX. |
| `app/root.tsx` | **Rewrite against RR** | `app/root.tsx` | Same layout, but `@remix-run/react` imports become `react-router`. |
| `app/routes.ts` | **Rewrite** | `app/routes.ts` | React Router template defines routes explicitly, not via `flatRoutes()`. |
| `app/routes/_index/route.tsx` | **Port loader logic** | `app/routes/_index.tsx` | Trivial redirect. |
| `app/routes/auth.$.tsx` | **Port** | `app/routes/auth.$.tsx` | Shopify-owned handler, small. |
| `app/routes/auth.login/route.tsx` + `error.server.ts` | **Port** | `app/routes/auth.login.tsx` | Polaris login screen + helper. |
| `app/routes/webhooks.*.tsx` (×5) | **Port loaders/actions 1:1** | `app/routes/webhooks.*.tsx` | Body is `authenticate.webhook(request)` + Prisma. Only imports change. |
| `app/routes/app.tsx` | **Rewrite `NavMenu`** | `app/routes/app.tsx` | Use React Router `Link` inside `NavMenu` (current repo uses raw `<a>`, which is the embedded anti-pattern the reviewer flagged). |
| `app/routes/app._index.tsx` | **Port** | same | Polaris onboarding screen. |
| `app/routes/app.categories._index.tsx` | **Port + style cleanup** | same | Uses ~90 lines of inline `React.CSSProperties`. Candidate for CSS modules during port. |
| `app/routes/app.categories.$slug.tsx` | **Port + style cleanup** | same | Same inline-styles story. |
| `app/routes/app.design.prompt.tsx` | **Port + fix multi-tenant bug** | same | See "Blockers" — must use `session.shop`, not `findFirst()`, when creating `ArcadeProduct`. |
| `app/routes/app.design.$id*.tsx` | **Build out the stub screens** | same | Today only `success.tsx` exists; the `_index` (PDP) and `pricing` routes are missing entirely. The port is a natural moment to build them against the real design. |
| `app/routes/app.orders.tsx` | **Port, swap mock data for real query** | same | Currently rendering mock `ORDERS` array. |
| `prisma/schema.prisma` | **1:1 copy** | `prisma/schema.prisma` | Framework-agnostic. Re-evaluate second-backend tables before copying — see matrix below. |
| `prisma/migrations/` | **1:1 copy** | `prisma/migrations/` | Migration history stays intact so the DB does not re-migrate. |
| `prisma/seed.ts` | **1:1 copy** | `prisma/seed.ts` | |
| `shopify.app*.toml` | **Copy, align API version** | same filenames | Carry the `2026-01` pin forward (current value on `claude/address-review-findings-uSZrc`). Re-evaluate against whatever the React Router template ships. |

### Signature-level example (loader + action)

Most loaders and actions need only an import-path change. Example from
`app/routes/app.design.prompt.tsx` — today:

```ts
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  // …
  return json({ productType });
};
```

After migration:

```ts
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data, useLoaderData, useFetcher } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  // …
  return data({ productType });
};
```

The body is unchanged. `json()` becomes `data()`. `useLoaderData`
lives in `react-router`. `ActionFunctionArgs` / `LoaderFunctionArgs`
come from `react-router`. This is true for every loader/action in the
repo — there is no business logic to port.

## Pre-migration blockers

These decisions must land **before** the port begins, not during it.
None of them require a week of work; they require a single decision
each, and then the port is unambiguous.

### B1. Source-of-truth matrix for the Prisma schema

The reviewer correctly flagged that the Shopify app DB is drifting
toward being a second Arcade backend. Before copying `schema.prisma`
into the new repo we need a decision — per entity — on whether it
stays, moves to the Arcade BE, or becomes a local cache of the Arcade
BE. Proposed default positions, **to be ratified with BE owner**:

| Entity | Current location | Proposed owner | Rationale |
|---|---|---|---|
| `Session` | Shopify app DB | **Shopify app DB** | Required by `@shopify/shopify-app-session-storage-prisma`. Must be local. |
| `Shop` | Shopify app DB | **Shopify app DB** | Binds Shopify domain → access token → Arcade account id. Must be local. |
| `ProductCategory` | Shopify app DB | **Arcade BE** | Catalog master data. App reads via API, caches in memory or HTTP-cache. |
| `ProductType` | Shopify app DB | **Arcade BE** | Same. Includes `specs`, `basePrice`, `sizeOptions`, `fabricOptions`, `manufacturerId` — all catalog. |
| `Manufacturer` | Shopify app DB | **Arcade BE** | Pure reference data. No reason to duplicate. |
| `ArcadeProduct` | Shopify app DB | **Arcade BE** (source) + local mirror | BE is canonical; the app keeps a thin mirror row so loaders can render without an extra round-trip and so `shopifyProductGid` reconciliation has a place to live. |
| `ProductVariant` | Shopify app DB | **Arcade BE** (source) + local mirror | Same pattern as `ArcadeProduct`. |
| `ArcadeOrder` | Shopify app DB | **Arcade BE** | Webhook lands here, app forwards to BE, BE becomes source of truth. App retains a view-only mirror for the Orders dashboard. |

The matrix above is a starting point for the BE conversation — it is
not the decision. The decision is "run this past [BE owner], get a
yes/no per row, lock the answer in before scaffold-time."

### B2. Publish state machine

`ArcadeProduct.status` is currently `DRAFT | ACTIVE`. The publish
pipeline needs at least a `PUBLISHING` intermediate state while the
`productCreate` Shopify GraphQL call is in flight, so that:

- A crash mid-publish doesn't leave a product stuck looking ACTIVE
  without a `shopifyProductGid`.
- Retry logic can key off the state instead of the presence/absence of
  `shopifyProductGid`.
- The success route (`app/routes/app.design.$id.success.tsx`) already
  bounces non-`ACTIVE` products back to pricing. Adding `PUBLISHING`
  lets us show a "still publishing…" screen instead.

Proposed state machine:

```
DRAFT ─────▶ PUBLISHING ─────▶ ACTIVE
               │
               └─ on error ──▶ DRAFT (with publishError: string)
```

This is a one-line Prisma enum change but it needs to happen in the
same migration as the schema copy, not after the port.

### B3. Multi-tenant shop resolution

Product creation currently uses `db.shop.findFirst({ where: { domain:
{ not: "" } } })`, which in a multi-store install attaches products to
whichever shop row sorts first. The correct pattern — scoping by
`session.shop` — must be adopted before or during the port so we don't
carry the bug into the new repo. Every loader/action in the new repo
should start from `session.shop`, never from `findFirst()`.

### B4. Config version drift

Three config sources used to disagree on the Shopify API version:

- `app/shopify.server.ts`: `ApiVersion.January25` *(past sunset)*
- `shopify.app.toml`: `api_version = "2025-01"` *(past sunset)*
- `shopify.app.arcadeai.toml`: `api_version = "2026-07"` *(fabricated —
  not exported by the installed `@shopify/shopify-api@13`)*

**Resolved on `claude/address-review-findings-uSZrc`:** aligned all
three on `2026-01` / `ApiVersion.January26`. Selection rationale:

- `@shopify/shopify-api@13.0.0` exports `October24`, `January25`,
  `April25`, `July25`, `October25`, `January26`, `April26`, and
  `Unstable`. (Verified by unpacking the v13.0.0 tarball from the npm
  registry — see `dist/ts/lib/types.d.ts`.)
- Shopify supports each stable API version for 12 months after
  release. Versions prior to `2025-04` are past sunset as of 2026-04
  and get auto-upgraded by Shopify at call time — unpredictable
  behavior we should not ship against in production.
- `January26` is the newest *non-bleeding-edge* option — released
  ~3 months ago, battle-tested, with roughly 9 months of remaining
  support runway. `April26` is the absolute latest but minted this
  quarter; we would rather not debug brand-new API behavior in prod.
- On bump: change all three files in the same commit. The runtime
  enum in `shopify.server.ts` and the webhook `api_version` in both
  tomls must agree, or webhook payloads arrive in a shape the runtime
  did not expect. Each file carries an inline comment pointing at
  this ADR so the lockstep rule is unmissable.

The React Router rescaffold (M0) will re-evaluate the pin based on
whichever version the official `@shopify/shopify-app-react-router`
template ships.

## Consequences

### Positive

- Aligns with current Shopify docs and templates; next Shopify-authored
  features (new hooks, new session strategies) land on the path we're on.
- Closes most of the `npm audit` findings in one go.
- Lower ramp-up for the rest of the team.
- Forces us to make the B1–B4 decisions that would otherwise accumulate
  as unplanned tech debt.

### Negative / risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Short-term velocity hit while the port is in flight | High | Medium | Only port what is already working (onboarding → prompt → webhooks). Leave speculative screens out of scope. |
| In-flight feature branches conflict with the rescaffold | Medium | High | Coordinate a freeze window. Rebase or re-land affected work on the new repo. |
| Prisma schema copy accidentally ports the second-backend structure unchanged | High if we rush B1 | High (we bake in the problem we're trying to fix) | B1 is a hard blocker on scaffold-time. No schema copy until the matrix is ratified. |
| React Router template pins a different `ApiVersion` enum than what our GraphQL typegen expects | Medium | Low | Re-run `graphql-codegen` against the new pin; fix the small set of failures. |
| Session storage upgrade (`@shopify/shopify-app-session-storage-prisma`) ships a breaking change between our version and the React Router template's | Low | Medium | Check the template's pinned version before scaffolding. If different, run the session migration locally before deploying. |
| Losing git history on the app code | Certain | Low | The rescaffold is a deliberate clean slate. Historical blame stays accessible via the archived old repo. |

## Acceptance criteria

The migration is "done" when all of the following hold on the new repo:

1. `@shopify/shopify-app-remix` and `@remix-run/*` do not appear in
   `package.json` or `package-lock.json`.
2. `npm audit --production` reports zero high or critical findings.
3. The happy path (install → onboarding → categories → prompt → design
   → pricing → publish → success) runs end-to-end against a dev store.
4. All five webhook routes respond 200 to the Shopify webhook tester.
5. The Prisma schema in the new repo matches the B1 matrix — no entity
   ported without a ratified owner column.
6. `ArcadeProduct.status` includes `PUBLISHING`.
7. Every loader/action resolves the shop via `session.shop`, never
   via `findFirst()`. A lint rule or a grep-in-CI guard enforces this.
8. `shopify.server.ts`, `shopify.app.toml`, and `shopify.app.*.toml`
   agree on a single `ApiVersion`. A comment in each file references
   this ADR as the lockstep rule.
9. `NavMenu` uses the framework `Link`, not raw `<a>`.
10. The old repo (`arcade-shopify-app`) is archived, and the new repo
    is renamed to take its place.

## Out of scope for this ADR

This ADR does not commit us to:

- A specific file layout inside the new repo beyond what Shopify's
  React Router template ships with.
- Rewriting the Polaris screens from scratch. The inline-styles cleanup
  is a "nice to do during the port" opportunity, not a blocker.
- Migrating to Shopify's managed billing, metafields, or fulfillment
  APIs. Those are separate decisions with separate ADRs.
- A data migration. The new repo reuses the same Postgres database and
  the same Prisma migration history.

## References

- Shopify: [Build a Shopify app (React Router template)](https://shopify.dev/docs/apps/build/scaffold)
- Shopify: [`@shopify/shopify-app-react-router` on npm](https://www.npmjs.com/package/@shopify/shopify-app-react-router)
- Remix: [Incremental path to React Router](https://remix.run/blog/incremental-path-to-react-19)
- Reviewer findings (Suman / Vivian): captured in the PR comment that
  prompted this ADR. The HIGH items are addressed by this document
  (stack choice, vulnerabilities, second-backend risk, multi-tenant
  bug); the MEDIUM items (NavMenu anchors, config drift) are addressed
  in the "Pre-migration blockers" and "Acceptance criteria" sections.
