import { describe, expect, it } from "vitest";
import {
  enforceVariantRetailForChannel,
  clampCommissionRatePercent,
  MIN_COMMISSION_RATE_PERCENT,
  MAX_COMMISSION_RATE_PERCENT,
} from "./channelPricing";

describe("clampCommissionRatePercent", () => {
  it("clamps to 5–200", () => {
    expect(clampCommissionRatePercent(1)).toBe(MIN_COMMISSION_RATE_PERCENT);
    expect(clampCommissionRatePercent(300)).toBe(MAX_COMMISSION_RATE_PERCENT);
    expect(clampCommissionRatePercent(12)).toBe(12);
  });
});

describe("enforceVariantRetailForChannel", () => {
  it("raises retail below cost; min commission may push retail above strict cost floor", () => {
    const out = enforceVariantRetailForChannel({
      productCost: 20,
      retailPrice: 10,
      commissionRatePercent: 100,
    });
    expect(out.retailPrice).toBeGreaterThanOrEqual(20);
    expect(out.wasAdjusted).toBe(true);
    expect(out.message).toBeDefined();
    const markup = out.retailPrice - 20;
    expect(markup + 1e-9).toBeGreaterThanOrEqual(0.05 * 20);
  });

  it("increases retail when commission dollars would be below 5% of base", () => {
    const out = enforceVariantRetailForChannel({
      productCost: 20,
      retailPrice: 20,
      commissionRatePercent: 5,
    });
    expect(out.retailPrice).toBeGreaterThan(20);
    const markup = out.retailPrice - 20;
    const commission = (markup * 5) / 100;
    expect(commission + 1e-6).toBeGreaterThanOrEqual(0.05 * 20);
  });
});
