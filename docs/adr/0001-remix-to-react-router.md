# ADR 0001 — Migrate scaffold from Shopify Remix to React Router

## Status

Accepted. Migration to be executed before we add significant new surface area.

## Context

This repo was scaffolded with [`@shopify/shopify-app-remix`](https://www.npmjs.com/package/@shopify/shopify-app-remix),
which was the official Shopify template at the time. Shopify has since
moved its official guidance and scaffolds to
[`@shopify/shopify-app-react-router`](https://www.npmjs.com/package/@shopify/shopify-app-react-router),
and Remix itself
[encourages teams to migrate to React Router v7](https://remix.run/blog/incremental-path-to-react-19).

Two things motivate the switch for us specifically:

1. **Team fit.** The rest of our app surface (customer-facing Next.js) is
   React-first. Most of the team is comfortable with React patterns,
   less so with Remix-specific conventions. React Router sits closer to
   plain React.
2. **Supply-chain hygiene.** `npm audit` on the current scaffold reports
   ~35 vulnerabilities, most transitively via older Remix/Vite dependency
   trees that the React Router template has already resolved. A fresh
   scaffold clears those without a hand-written audit pass.

We're still small enough that the cost of switching is low — the number
of shipped screens is limited and most of the logic is in loaders,
actions, and the Prisma schema, none of which are Remix-specific.

## Decision

We will migrate the Shopify app to `@shopify/shopify-app-react-router`.

**Approach:** scaffold a new app using the React Router template and
port routes/components into it, rather than attempting an in-place
dependency swap. This avoids dragging old lockfile/transitive issues
into the new tree and gives us a clean chance to re-evaluate anything
we built quickly during the initial spike.

### What can be ported as-is

- Prisma schema and migrations (unchanged; the DB layer is framework-agnostic).
- Webhook handlers — the logic inside `webhooks.*.tsx` is just
  `authenticate.webhook` + Prisma mutations. File location changes, the
  code does not.
- Server-side business logic currently colocated with routes: the DB
  lookups and Shopify GraphQL calls move to plain `.server.ts` modules
  (e.g. `app/services/products.server.ts`) that the new routes import.
- Polaris components, `Page` / `Card` / `BlockStack` usage — all of it
  is plain React and survives.
- Seed data (`prisma/seed.ts`).

### What gets rebuilt against React Router primitives

- `app/routes/app.tsx`: `AppProvider` wiring, `NavMenu` with framework
  `Link` (finally not `<a>`), error boundary, headers export.
- Loaders and actions: signatures change from `@remix-run/node` types
  to React Router's. Body logic stays.
- Data fetching hooks in components: `useLoaderData`,
  `useFetcher`, `useNavigation` move to the React Router equivalents.
- `routes.ts` config: React Router doesn't use `@remix-run/fs-routes`;
  route tree is defined explicitly.

### What should be reconsidered during the port (not ported as-is)

- **Ad-hoc inline CSS.** Several screens (`app.categories._index.tsx`,
  `app.design.prompt.tsx`, `app.design.$id*.tsx`) carry large inline
  `Record<string, React.CSSProperties>` style objects. The React Router
  template gives us a cleaner opportunity to move these behind Polaris
  tokens / CSS modules.
- **Prisma catalog tables as a second backend.** See the source-of-truth
  matrix in `docs/architecture.md`. Before porting, land the decision on
  which of `ProductCategory` / `ProductType` / `Manufacturer` /
  `ArcadeProduct` / `ProductVariant` / `ArcadeOrder` remain in the
  Shopify app DB (as caches / UI bindings) and which move fully to the
  Arcade backend.
- **`ArcadeProduct.status`** currently only has `DRAFT` / `ACTIVE`. The
  publish pipeline needs at least a `PUBLISHING` intermediate state
  (while `productCreate` is in flight) to reason about idempotency when
  we retry after a crash.

## Consequences

### Positive

- Aligns with current Shopify docs and templates; next Shopify-authored
  features (new hooks, new session strategies) land on the path we're on.
- Closes most of the `npm audit` findings in one go.
- Lower ramp-up for the rest of the team.

### Negative / risks

- Short-term velocity hit while the port is in flight. Mitigated by
  only porting what's already working (the prompt → design → pricing →
  success flow plus webhooks) and leaving UI-only screens for later.
- Any in-flight branches against `app/routes/*` need to be rebased onto
  the new route structure. Coordinate a freeze window.

## Migration checklist

- [ ] Scaffold `arcade-shopify-app-v2` from the official React Router
      template: `npm init @shopify/app@latest -- --template react-router`.
- [ ] Copy `prisma/schema.prisma` + `prisma/migrations` + `prisma/seed.ts`.
- [ ] Port `app/db.server.ts` (1:1).
- [ ] Port `app/shopify.server.ts` — swap the import from
      `@shopify/shopify-app-remix/server` to
      `@shopify/shopify-app-react-router/server`. Keep `ApiVersion` pinned
      to whatever the template ships (and update `shopify.app*.toml` to
      match — see `docs/architecture.md`).
- [ ] Port webhook routes (`app/routes/webhooks.*.tsx`) — handler logic
      is unchanged, only the route file conventions change.
- [ ] Port the onboarding → categories → prompt → design → pricing →
      success flow, in that order.
- [ ] Port `app/routes/app.tsx`, making sure `NavMenu` uses the
      framework `Link` (not `<a>`).
- [ ] Add the source-of-truth matrix from `docs/architecture.md` as the
      gate for each Prisma model before re-introducing it.
- [ ] Bump API version during the port if the React Router template
      pins a newer one; update all three config files in lockstep.
- [ ] Re-run `npm audit` on the new repo; expect the 35 findings to
      drop to near-zero.
- [ ] Cut-over: rename the new repo to `arcade-shopify-app`, archive
      the old one. There's no in-place `git` history merge — the port
      is deliberately a clean restart.

## References

- Shopify: [App template migration notes](https://shopify.dev/docs/apps/build/scaffold)
- Remix: [Incremental path to React Router](https://remix.run/blog/incremental-path-to-react-19)
- Reviewer findings (Suman / Vivian): captured in the PR comment that
  prompted this ADR.
