import { describe, expect, it } from "vitest";
import { transformShopifyPrintedTextileDesignPrompt } from "./shopifyDesignPromptTransform";

describe("transformShopifyPrintedTextileDesignPrompt", () => {
  it("replaces pillow-related product nouns with design", () => {
    expect(
      transformShopifyPrintedTextileDesignPrompt("floral throw Pillow"),
    ).toBe("floral throw design");
  });

  it("handles multi-word phrases before single words", () => {
    expect(
      transformShopifyPrintedTextileDesignPrompt("sofa pillows with stripes"),
    ).toBe("design with stripes");
  });

  it("collapses repeated design tokens", () => {
    expect(
      transformShopifyPrintedTextileDesignPrompt("pillow cushion motif"),
    ).toBe("design motif");
  });

  it("does not replace substrings inside words", () => {
    expect(
      transformShopifyPrintedTextileDesignPrompt("pillowcase study"),
    ).toBe("pillowcase study");
  });
});
