import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
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

  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">
          Home
        </a>
        <a href="/app/categories">Create Product</a>
        <a href="/app/orders">Orders</a>
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
