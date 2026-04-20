import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  data,
  Link,
  Outlet,
  redirect,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../../shopify.server";
import {
  ensureShopRecord,
  getArcadeAccountIdForShop,
} from "../../services/arcade/arcadeAuth.server";
import { env } from "../../lib/env/env.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

const SHOP_CURRENCY_QUERY = `#graphql
  query shopCurrency {
    shop {
      currencyCode
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  await ensureShopRecord(session);

  const url = new URL(request.url);
  const onConnectArcade = url.pathname.endsWith("/connect-arcade");

  const linkedAccountId = await getArcadeAccountIdForShop(session.shop);

  if (!linkedAccountId && !onConnectArcade) {
    throw redirect("/app/connect-arcade");
  }
  if (linkedAccountId && onConnectArcade) {
    throw redirect("/app");
  }

  const currencyRes = await admin.graphql(SHOP_CURRENCY_QUERY);
  const currencyJson = await currencyRes.json();
  const currencyCode = currencyJson.data?.shop?.currencyCode as
    | string
    | undefined;
  if (currencyCode && currencyCode !== "USD") {
    throw new Response(
      "Arcade for Shopify currently supports stores with checkout pricing in USD only.",
      { status: 403 },
    );
  }

  return data({ apiKey: env.SHOPIFY_API_KEY });
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
