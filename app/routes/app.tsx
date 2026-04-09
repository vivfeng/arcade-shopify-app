import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Upsert shop record for account provisioning (BE-1678)
  await db.shop.upsert({
    where: { domain: session.shop },
    update: {
      accessToken: session.accessToken ?? "",
    },
    create: {
      domain: session.shop,
      accessToken: session.accessToken ?? "",
      email: (session as unknown as { email?: string }).email ?? null,
      name: session.shop.replace(".myshopify.com", ""),
      installedAt: new Date(),
    },
  });

  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      {/*
        NavMenu must use the framework's client-side <Link>, not raw
        <a> tags. Inside the Shopify admin iframe, anchor navigation
        drops the session token on the URL and causes a top-frame
        reload — the embedded app then loses its session and re-auths.
        See review finding #6 and ADR 0001 policy rule 3 (this is a
        surgical fix on an existing Remix file, no new Remix imports).
      */}
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/categories">Create Product</Link>
        <Link to="/app/orders">Orders</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
