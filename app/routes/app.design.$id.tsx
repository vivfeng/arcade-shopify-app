import { Outlet } from "@remix-run/react";

// Passthrough layout for the `/app/design/:id` subtree. Each child
// (`_index`, `pricing`, `success`) runs its own authenticated loader and
// owns its UI — this file exists only to satisfy flat-routes nesting so
// siblings like `pricing.tsx` and `success.tsx` resolve under the `:id`
// segment.
export default function DesignIdLayout() {
  return <Outlet />;
}
