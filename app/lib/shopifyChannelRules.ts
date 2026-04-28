/** Canonical Arcade maker UUIDs allowed for Shopify dreaming (Esme, Lattice and Loom). */
export const ALLOWED_SHOPIFY_MAKER_IDS = new Set([
  "294facb5-9ff1-4ae6-b1c6-e6e94cf64849",
  "5d25f996-396e-4e32-afa6-dd6a5c277281",
]);

/** Nautical seller GraphQL IDs (reference for payouts / future BE work). */
export const ESME_NAUTICAL_SELLER_GID = "U2VsbGVyOjQ2";
export const LATTICE_AND_LOOM_NAUTICAL_SELLER_GID = "U2VsbGVyOjQ4";

export function isAllowedShopifyManufacturerId(
  manufacturerId: string | null | undefined,
): boolean {
  if (!manufacturerId) return false;
  return ALLOWED_SHOPIFY_MAKER_IDS.has(manufacturerId);
}
