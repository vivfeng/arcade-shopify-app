// Centralized route path registry for the embedded Arcade app.
//
// Prefer these helpers over raw string literals in route files. When a
// route path changes or a new route is added, updating this single file
// is enough — the TypeScript compiler will flag every call site that
// needs attention. Framework-agnostic on purpose: safe to import from
// both `@remix-run/*` files and `react-router` files during the M0
// migration (ADR 0001), and will survive the rescaffold unchanged.

export const routes = {
  /** Embedded app home (`app.tsx` index). */
  home: "/app",
  /** Category grid (`app.categories._index.tsx`). */
  categories: "/app/categories",
  /** Single category detail (`app.categories.$slug.tsx`). */
  categoryDetail: (slug: string) => `/app/categories/${slug}`,
  /**
   * Prompt design screen. Product type slug is required — the loader
   * throws a 400 if the `type` query param is missing.
   */
  designPrompt: (typeSlug: string) => `/app/design/prompt?type=${typeSlug}`,
  /** Post-publish success screen (`app.design.$id.success.tsx`). */
  designSuccess: (id: string) => `/app/design/${id}/success`,
  /** Pricing configuration (`app.design.$id.pricing.tsx`). */
  designPricing: (id: string) => `/app/design/${id}/pricing`,
  /** Orders dashboard (`app.orders.tsx`). */
  orders: "/app/orders",
} as const;
