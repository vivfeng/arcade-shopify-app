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

- **Shopify-owned** — data only Shopify produces (session tokens,
  product GIDs, webhook payloads). We can only store a cache.
- **App-owned (local)** — must live in the Shopify app DB because
  something framework-level requires it there (`Session`) or because
  it binds Shopify → Arcade identities (`Shop`).
- **BE-owned (remote)** — Arcade backend is source of truth. App
  calls a BE API and either passes results through or holds a
  short-lived cache.
- **BE-owned + local mirror** — BE is source of truth, but the app
  keeps a thin local row for reconciliation (e.g. to store
  `shopifyProductGid` once we've called `productCreate`, or to render
  lists without a round-trip).

## Proposed matrix

| Entity | Today | Proposed owner | Notes |
|---|---|---|---|
| `Session` | App DB | **App DB (required)** | `@shopify/shopify-app-session-storage-prisma` hard-requires this. No BE option. |
| `Shop` | App DB | **App DB (required)** | Binds `shopify_domain` → `access_token` → `arcade_account_id`. The link table between the two systems. No BE option. |
| `ProductCategory` | App DB | **BE-owned** | Catalog reference data. App fetches via BE API, no local persistence. |
| `ProductType` | App DB | **BE-owned** | Same. Includes `specs`, `basePrice`, `sizeOptions`, `fabricOptions`, `manufacturerId` — all catalog. |
| `Manufacturer` | App DB | **BE-owned** | Pure reference data. Manufacturer network is an Arcade concept, not a per-merchant one. |
| `ArcadeProduct` | App DB | **BE-owned + local mirror** | BE canonical. Local mirror stores `shopifyProductGid`, publish state, and enough to render lists. |
| `ProductVariant` | App DB | **BE-owned + local mirror** | Same pattern as `ArcadeProduct`. |
| `ArcadeOrder` | App DB | **BE-owned + local mirror** | Shopify webhook lands in app → forwarded to BE → BE becomes source of truth. Local mirror kept for the Orders dashboard and GDPR redaction. |

## Open questions for BE team

1. **Is there a catalog API today?** If not, when. The rescaffold can't
   proceed on "BE-owned" entities until there's a read endpoint for
   categories/types/manufacturers.
2. **What's the ID convention?** Current Prisma uses `cuid()`. If BE
   uses UUIDs or its own id space, the mirror rows need to key on BE
   ids, not regenerate locally.
3. **Publish contract for `ArcadeProduct`** — does the app POST the
   designed product to BE and get back an id, or does BE create the
   product and the app just references it? This determines whether
   the local mirror is write-through or read-only.
4. **Order forwarding** — does the app call BE synchronously from the
   `orders/create` webhook handler, or push to a queue? Idempotency
   strategy?
5. **GDPR webhooks** (`customers/redact`, `shop/redact`) currently
   delete directly from the app DB. If orders move to BE, the app
   needs to forward the redaction too — does BE have an endpoint for
   that, and what's the SLA?

## What "ratified" means

BE owner marks each of the 8 entity rows in the matrix above as
"accepted" or "revised" and commits any changes back to this file.
Open questions are answered or explicitly deferred. After that,
M0 can copy the schema forward with only the required + mirror
entities, and the BE API client gets stubbed for the rest.

## Next steps

- [ ] Share this file with BE owner (Slack thread or ticket link here).
- [ ] BE review, per-row yes/no.
- [ ] Once ratified, expand each "BE-owned" row into an API contract
      sub-doc (request shape, response shape, caching rules).
- [ ] Update ADR 0001 B1 to point at this file as the canonical matrix.
- [ ] Unblock M0.
