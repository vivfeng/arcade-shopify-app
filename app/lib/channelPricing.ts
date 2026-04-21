/**
 * USD pricing rules for the Shopify channel:
 * - Retail cannot go below maker schedule cost (base).
 * - Product commission rate is 5–200% (applied to markup dollars).
 * - Commission dollars must be at least 5% of base (dollar floor).
 */

export const MIN_COMMISSION_RATE_PERCENT = 5;
export const MAX_COMMISSION_RATE_PERCENT = 200;
/** Minimum commission dollars = this fraction × base (schedule / maker cost). */
export const MIN_COMMISSION_DOLLARS_FACTOR_OF_BASE = 0.05;

export const PRICE_AND_COMMISSION_USER_MESSAGE =
  "The price was reset to the minimum allowed for this product. The minimum commission rate you can set is 5%.";

export function clampCommissionRatePercent(rate: number): number {
  return Math.min(
    MAX_COMMISSION_RATE_PERCENT,
    Math.max(MIN_COMMISSION_RATE_PERCENT, rate),
  );
}

/**
 * Enforces floor retail and minimum commission dollars on markup.
 * Commission dollars = markup × (commissionRatePercent / 100).
 */
export function enforceVariantRetailForChannel(params: {
  productCost: number;
  retailPrice: number;
  commissionRatePercent: number;
}): {
  retailPrice: number;
  wasAdjusted: boolean;
  message?: string;
} {
  const base = params.productCost;
  if (!(base > 0) || !Number.isFinite(base)) {
    return { retailPrice: params.retailPrice, wasAdjusted: false };
  }

  const rate = clampCommissionRatePercent(params.commissionRatePercent);
  let retail = Math.max(base, params.retailPrice);
  let wasAdjusted = retail !== params.retailPrice;
  const markup = retail - base;
  let commissionDollars = (markup * rate) / 100;
  const minCommissionDollars = MIN_COMMISSION_DOLLARS_FACTOR_OF_BASE * base;

  if (commissionDollars + 1e-9 < minCommissionDollars) {
    const requiredMarkup = (minCommissionDollars * 100) / rate;
    retail = base + requiredMarkup;
    wasAdjusted = true;
    commissionDollars = (retail - base) * (rate / 100);
    if (commissionDollars + 1e-9 < minCommissionDollars) {
      retail = base + minCommissionDollars / (rate / 100);
    }
  }

  return {
    retailPrice: Math.round(retail * 100) / 100,
    wasAdjusted,
    message: wasAdjusted ? PRICE_AND_COMMISSION_USER_MESSAGE : undefined,
  };
}

export function markupPercentFromRetail(
  productCost: number,
  retailPrice: number,
): number {
  if (!(productCost > 0)) return 0;
  return Math.round(((retailPrice - productCost) / productCost) * 10000) / 100;
}
