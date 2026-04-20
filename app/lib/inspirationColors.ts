import type { RgbTuple } from "./color-picker/types";

/** Matches Arcade Lab `CreatePage` / `createPatternBatch` inspiration color payloads. */
export const MAX_CREATE_INSPIRATION_COLORS = 3;

export type CreateInspirationColor = {
  kind: "pantone" | "sampled";
  token: string;
  label: string;
  hex: string;
  rgb: RgbTuple;
};

export function getInspirationColorSummary(
  colors: readonly CreateInspirationColor[],
): string {
  if (colors.length === 0) {
    return "Colors";
  }
  if (colors.length === 1) {
    return colors[0]?.label ?? "Colors";
  }
  return `${colors.length} colors`;
}
