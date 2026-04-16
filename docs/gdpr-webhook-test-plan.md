# GDPR webhook test plan

Manual fire-drill for the four Shopify compliance webhooks the app
implements. Use this when verifying BE-1679, before any Shopify App
Store submission (PD-628), and any time the handlers in
`app/routes/webhooks.*` change.

There is no automated test runner in this repo yet (no vitest / jest);
this checklist is the canonical verification path.

## Endpoints under test

| Topic                     | Route file                                          | What it should do                                                                              |
| ------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `customers/data_request`  | `app/routes/webhooks.customers.data-request.tsx`    | Read-only. Logs a structured record of stored customer data; no DB writes.                     |
| `customers/redact`        | `app/routes/webhooks.customers.redact.tsx`          | Replaces `customerName` / `customerEmail` on matching `ArcadeOrder` rows with `[REDACTED]`.    |
| `shop/redact`             | `app/routes/webhooks.shop.redact.tsx`               | Single `$transaction` deleting all ProductVariant + ArcadeProduct + ArcadeOrder + Shop rows.   |
| `app/uninstalled`         | `app/routes/webhooks.app.uninstalled.tsx`           | Deletes all sessions for the shop, sets `Shop.uninstalledAt`, clears `Shop.accessToken`.       |

## Setup

1. `shopify app dev` — boots the app against the dev store and prints
   the local tunnel URL. Leave this running in one terminal so you
   can watch the dev server log for the handler `console.log` output.
2. In a second terminal, seed a fixture shop, product, and order so
   the redact handlers have something to delete. You can do this via
   `prisma studio` or a small `prisma db seed` script — pick one
   shop domain (e.g. `gdpr-test.myshopify.com`) and reuse it across
   the four cases below.
3. Confirm `shopify.app.toml` and `shopify.app.arcadeai.toml` are
   byte-aligned for the three compliance subscriptions:
   ```
   diff <(grep -A2 compliance_topics shopify.app.toml) \
        <(grep -A2 compliance_topics shopify.app.arcadeai.toml)
   ```
   The diff should be empty.

## Fire each webhook

Use `shopify app webhook trigger` from the project root. The
`--address` flag must point at the local tunnel URL printed by
`shopify app dev`. Replace `<TUNNEL>` below.

### 1. `customers/data_request`

```sh
shopify app webhook trigger \
  --topic=customers/data_request \
  --api-version=2026-01 \
  --delivery-method=http \
  --address=<TUNNEL>/webhooks/customers/data-request
```

**Pass criteria:**
- Handler returns 200 (visible in the trigger CLI output and dev server log).
- Dev server log contains either:
  - `[gdpr:data_request] <shop> / <email>: {"shop":...,"recordCount":N,"orders":[...]}`, or
  - `[gdpr:data_request] <shop> / <email>: no stored orders — nothing to deliver`, or
  - `[gdpr:data_request] <shop>: payload missing customer.email — nothing to look up`
- No DB writes. Run `prisma studio` and confirm row counts unchanged.

### 2. `customers/redact`

```sh
shopify app webhook trigger \
  --topic=customers/redact \
  --api-version=2026-01 \
  --delivery-method=http \
  --address=<TUNNEL>/webhooks/customers/redact
```

**Pass criteria:**
- Handler returns 200.
- Any `ArcadeOrder` row matching `customerEmail = <payload email>` AND `shop.domain = <fixture shop>` now has `customerName = "[REDACTED]"` and `customerEmail = "[REDACTED]"`.
- No rows from a *different* shop are touched. Verify by running the `customers/redact` against `shop-a` and confirming `shop-b`'s orders for the same email are untouched (multi-tenant guard from ADR 0001 blocker B3).

### 3. `shop/redact`

```sh
shopify app webhook trigger \
  --topic=shop/redact \
  --api-version=2026-01 \
  --delivery-method=http \
  --address=<TUNNEL>/webhooks/shop/redact
```

**Pass criteria:**
- Handler returns 200.
- All `ProductVariant`, `ArcadeProduct`, `ArcadeOrder`, and `Shop` rows for the fixture shop are gone in a single transaction.
- Other shops are untouched.
- Re-fire the same trigger immediately. The second delivery still returns 200 via the `Prisma.P2025` idempotent branch — dev server log prints `Shop <shop> already redacted — idempotent success`.

> **Grace period note:** in production, Shopify waits ~48h after an
> uninstall before firing `shop/redact`. The handler does not enforce
> this — it deletes whatever it's asked to delete the moment the
> webhook arrives. The grace period is Shopify's, not ours.

### 4. `app/uninstalled`

```sh
shopify app webhook trigger \
  --topic=app/uninstalled \
  --api-version=2026-01 \
  --delivery-method=http \
  --address=<TUNNEL>/webhooks/app/uninstalled
```

**Pass criteria:**
- Handler returns 200.
- Every `Session` row with `shop = <fixture shop>` is gone.
- The fixture `Shop` row now has `uninstalledAt` set to "now-ish" and `accessToken = ""`.
- Re-fire the trigger after deleting the Shop row by hand. The second delivery still returns 200 via the P2025 branch — dev server log prints `Shop <shop> not present in DB — idempotent uninstall success`.
- A real DB error (e.g. stop the local Postgres while the trigger fires) propagates as a 5xx so Shopify retries — it is **not** silently swallowed by the previous bare `.catch(() => {})`.

## Pre-App-Store-submission checklist (for PD-628)

Before submitting to the Shopify App Store, run all four sections above
end-to-end and capture the dev server log output. App Store reviewers
test the same four webhooks via Shopify's "GDPR test" tool. Pass criteria:

- [ ] All four webhooks return 200 on first delivery.
- [ ] All four webhooks return 200 on duplicate delivery (idempotency).
- [ ] `customers/redact` and `shop/redact` only affect the target shop.
- [ ] `customers/data_request` produces a structured log line that an operator can grep for and forward to the merchant.
- [ ] Dev and prod TOML configs (`shopify.app.toml` / `shopify.app.arcadeai.toml`) are aligned for compliance subscriptions.
- [ ] No new vulnerabilities introduced (`npm audit` deltas tracked separately under the M0 rescaffold; ADR 0001 blocker).

If any item fails, do **not** submit. Open a sub-ticket and re-run.
