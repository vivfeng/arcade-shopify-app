/**
 * Arcade API client for account provisioning and linking.
 *
 * Used during shop onboarding (BE-1678) to implement three OAuth states:
 *   State 1: No existing Arcade account → auto-provision silently
 *   State 2: Matching email → auto-link to existing Arcade account
 *   State 3: Different email → falls back to State 1 (post-MVP merge-later)
 *
 * Requires env vars:
 *   ARCADE_API_URL  — e.g. "https://api.arcade.ai"
 *   ARCADE_API_KEY  — Bearer token for server-to-server auth
 */

const ARCADE_API_URL = process.env.ARCADE_API_URL;
const ARCADE_API_KEY = process.env.ARCADE_API_KEY;

interface ArcadeAccount {
  id: string;
  email: string;
  name?: string;
}

interface ProvisionParams {
  email: string;
  storeName: string;
  storeUrl: string;
  shopifyStoreId?: string;
}

async function arcadeFetch(path: string, options: RequestInit = {}) {
  if (!ARCADE_API_URL || !ARCADE_API_KEY) {
    console.warn(
      "Arcade API not configured (ARCADE_API_URL / ARCADE_API_KEY missing). Skipping.",
    );
    return null;
  }

  const res = await fetch(`${ARCADE_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ARCADE_API_KEY}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    console.error(
      `Arcade API error: ${res.status} ${res.statusText} for ${options.method ?? "GET"} ${path}`,
    );
    return null;
  }

  return res.json();
}

/**
 * Look up an existing Arcade account by email.
 * Returns the account if found, null otherwise.
 *
 * TODO: Confirm endpoint path and response shape with Arcade API spec.
 *       Expected: GET /api/v1/accounts?email=<email>
 *       Response: { account: { id, email, name } } | { account: null }
 */
export async function findAccountByEmail(
  email: string,
): Promise<ArcadeAccount | null> {
  const data = await arcadeFetch(
    `/api/v1/accounts?email=${encodeURIComponent(email)}`,
  );
  return data?.account ?? null;
}

/**
 * Provision a new Arcade account using Shopify OAuth data.
 * No signup form, no email verification — silent auto-provision.
 *
 * TODO: Confirm endpoint path, request body, and response shape with Arcade API spec.
 *       Expected: POST /api/v1/accounts
 *       Body:     { email, name, storeUrl, shopifyStoreId }
 *       Response: { account: { id, email, name } }
 */
export async function provisionAccount(
  params: ProvisionParams,
): Promise<ArcadeAccount | null> {
  const data = await arcadeFetch("/api/v1/accounts", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      name: params.storeName,
      storeUrl: params.storeUrl,
      shopifyStoreId: params.shopifyStoreId,
    }),
  });
  return data?.account ?? null;
}

/**
 * Resolve the Arcade account for a Shopify shop.
 *
 * Logic (per BE-1678 acceptance criteria):
 *   1. If shop already has an arcadeAccountId, return it (no-op).
 *   2. If shop email matches an existing Arcade account, link it (State 2).
 *   3. Otherwise, auto-provision a new Arcade account (State 1).
 *
 * Returns the arcadeAccountId, or null if the API is not configured.
 */
export async function resolveArcadeAccount(shop: {
  domain: string;
  email: string | null;
  name: string | null;
  arcadeAccountId: string | null;
}): Promise<string | null> {
  // Already linked — nothing to do
  if (shop.arcadeAccountId) {
    return shop.arcadeAccountId;
  }

  if (!ARCADE_API_URL || !ARCADE_API_KEY) {
    console.warn(
      "Arcade API not configured. Skipping account resolution for",
      shop.domain,
    );
    return null;
  }

  // State 2: Check if email matches an existing account
  if (shop.email) {
    const existing = await findAccountByEmail(shop.email);
    if (existing) {
      console.log(
        `Linked shop ${shop.domain} to existing Arcade account ${existing.id} (matched by email)`,
      );
      return existing.id;
    }
  }

  // State 1: Auto-provision new account
  const newAccount = await provisionAccount({
    email: shop.email ?? `${shop.domain}@shopify-merchant.arcade.ai`,
    storeName: shop.name ?? shop.domain.replace(".myshopify.com", ""),
    storeUrl: `https://${shop.domain}`,
  });

  if (newAccount) {
    console.log(
      `Provisioned new Arcade account ${newAccount.id} for shop ${shop.domain}`,
    );
    return newAccount.id;
  }

  console.error(`Failed to provision Arcade account for shop ${shop.domain}`);
  return null;
}
