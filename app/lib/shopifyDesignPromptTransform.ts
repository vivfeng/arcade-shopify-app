/**
 * Replaces printed-textile product nouns (pillow, cushion, napkin, …) with "design"
 * so generation targets a flat pattern, not a photo of the product.
 */

const TERMS_REPLACED_WITH_DESIGN = [
  "set of placemats",
  "placemat set",
  "sofa pillows",
  "sofa pillow",
  "table covering",
  "head covering",
  "window covering",
  "tablecloth",
  "handkerchief",
  "table cloth",
  "table linen",
  "table runner",
  "placemats",
  "placemat",
  "drapery",
  "curtains",
  "curtain",
  "napkins",
  "napkin",
  "scarves",
  "scarfs",
  "scarf",
  "pillows",
  "pilows",
  "cushions",
  "cushion",
  "pillow",
  "pilow",
  "drapes",
  "runner",
  "shade",
] as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word, case-insensitive replacement (same idea as maker-service `replace_terms`).
 */
export function transformShopifyPrintedTextileDesignPrompt(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }

  const sorted = [...TERMS_REPLACED_WITH_DESIGN].sort(
    (a, b) => b.length - a.length,
  );
  const pattern = new RegExp(
    `(?<!\\w)(?:${sorted.map(escapeRegExp).join("|")})(?!\\w)`,
    "gi",
  );

  let out = trimmed.replace(pattern, "design");
  out = out.replace(/\bdesign\b(?:\s+\bdesign\b)+/gi, "design");
  return out.replace(/\s{2,}/g, " ").trim();
}
