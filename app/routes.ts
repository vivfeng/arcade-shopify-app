import {
  type RouteConfig,
  route,
  layout,
  index,
  prefix,
} from "@react-router/dev/routes";

export default [
  index("./routes/_index.tsx"),

  ...prefix("app", [
    layout("./routes/app/layout.tsx", [
      index("./routes/app/home.tsx"),
      route("orders", "./routes/app/orders.tsx"),
      ...prefix("categories", [
        index("./routes/app/categories/index.tsx"),
        route(":slug", "./routes/app/categories/$slug.tsx"),
      ]),
      ...prefix("design", [
        route("prompt", "./routes/app/design/prompt.tsx"),
        route(":id/pricing", "./routes/app/design/$id.pricing.tsx"),
        route(":id/success", "./routes/app/design/$id.success.tsx"),
      ]),
    ]),
  ]),

  ...prefix("auth", [
    route("*", "./routes/auth/$.tsx"),
    route("login", "./routes/auth/login.tsx"),
  ]),

  ...prefix("webhooks", [
    route("app/uninstalled", "./routes/webhooks/app-uninstalled.tsx"),
    route("app/scopes-update", "./routes/webhooks/app-scopes-update.tsx"),
    route(
      "customers/data-request",
      "./routes/webhooks/customers-data-request.tsx",
    ),
    route("customers/redact", "./routes/webhooks/customers-redact.tsx"),
    route("shop/redact", "./routes/webhooks/shop-redact.tsx"),
  ]),
] satisfies RouteConfig;
