// Shared design tokens for the embedded Arcade app.
//
// These values are the source of truth for custom styling that falls outside
// Polaris. Any hex color, font family, radius, or shadow that appears in more
// than one route should live here — not inline. Polaris primitives should
// still be preferred where they fit; this file covers the bespoke
// Arcade-branded surfaces (beige canvas, gold accents, success state, etc.).

export const colors = {
  // Page / surface
  pageBg: "#f7f4f0",
  cardBg: "#ffffff",
  cardBorder: "#deddd5",
  cardBorderSoft: "#e1dfdb",
  cardBorderHover: "#c5c2bc",
  surfaceMuted: "#e9e5d8",

  // Text
  textPrimary: "#0f0f0f",
  textSecondary: "#45413b",
  textSubdued: "#696864",

  // Brand gold accent
  gold: "#988c52",
  goldDark: "#6b6339",
  goldPale: "#f3eec5",
  goldBorder: "#d4ce9e",

  // Status — success
  successBg: "#e8f8ed",
  successFg: "#2ca84f",
} as const;

export const fonts = {
  sans: "'Instrument Sans', sans-serif",
  display: "'Inter', sans-serif",
  mono: "'DM Mono', monospace",
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  pill: 16,
  full: 28,
} as const;

export const shadows = {
  card: "0px 1px 4px 0px rgba(0,0,0,0.06)",
  dropdown: "0px 4px 12px rgba(0,0,0,0.1)",
} as const;
