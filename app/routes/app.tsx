import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Shop record provisioning (BE-1678). This runs on every embedded app
  // request, so avoid the write unless the record is actually missing or
  // the access token has rotated — an unconditional upsert on the hot path
  // wastes a round-trip to Postgres on every navigation.
  const incomingToken = session.accessToken ?? "";
  const existing = await db.shop.findUnique({
    where: { domain: session.shop },
    select: { accessToken: true },
  });

  if (!existing) {
    await db.shop.create({
      data: {
        domain: session.shop,
        accessToken: incomingToken,
        name: session.shop.replace(".myshopify.com", ""),
        installedAt: new Date(),
      },
    });
  } else if (existing.accessToken !== incomingToken) {
    await db.shop.update({
      where: { domain: session.shop },
      data: { accessToken: incomingToken },
    });
  }

  return data({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>
        <NavMenu>
          <Link to="/app" rel="home">
            Home
          </Link>
          <Link to="/app/categories">Create Product</Link>
          <Link to="/app/orders">Orders</Link>
        </NavMenu>
        <Outlet />
      </PolarisAppProvider>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
