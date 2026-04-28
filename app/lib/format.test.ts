import { describe, expect, it } from "vitest";
import { formatPrice, gidToNumericId } from "./format";

describe("formatPrice", () => {
  it("formats a plain number", () => {
    expect(formatPrice(24)).toBe("$24.00");
  });

  it("formats a decimal number", () => {
    expect(formatPrice(24.5)).toBe("$24.50");
  });

  it("formats a numeric string (Prisma Decimal path)", () => {
    expect(formatPrice("19.99")).toBe("$19.99");
  });

  it("rounds to 2 decimal places", () => {
    expect(formatPrice(24.999)).toBe("$25.00");
  });

  it("handles zero", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });
});

describe("gidToNumericId", () => {
  it("extracts numeric ID from a valid Product GID", () => {
    expect(gidToNumericId("gid://shopify/Product/12345")).toBe("12345");
  });

  it("returns null for null input", () => {
    expect(gidToNumericId(null)).toBeNull();
  });

  it("returns null for a GID missing the numeric suffix", () => {
    expect(gidToNumericId("gid://shopify/Product/")).toBeNull();
  });

  it("returns null for a non-Product GID", () => {
    expect(gidToNumericId("gid://shopify/Order/12345")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(gidToNumericId("")).toBeNull();
  });
});
