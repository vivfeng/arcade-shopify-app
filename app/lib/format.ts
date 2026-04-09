import type { Prisma } from "@prisma/client";

// Shared formatting + parsing helpers for values that cross the
// route / UI boundary. Keep these tiny and pure — anything with
// side effects belongs elsewhere.

/**
 * Format a Prisma Decimal (or any number-coercible value) as a USD
 * price string like `"$24.00"`. Intentionally currency-agnostic at
 * the call site: callers pass the raw decimal, we handle display.
 */
export function formatPrice(value: Prisma.Decimal | number | string): string {
  return `$${Number(value).toFixed(2)}`;
}

/**
 * Parse a Shopify product GID (`gid://shopify/Product/12345`) into
 * its numeric ID so we can build `shopify://admin/products/{id}`
 * deep links. Returns null for null input or a malformed GID.
 */
export function gidToNumericId(gid: string | null): string | null {
  if (!gid) return null;
  const match = gid.match(/\/Product\/(\d+)$/);
  return match ? match[1] : null;
}
