import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { resolveArcadeAccount } from "../arcade-api.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Upsert shop record for account provisioning (BE-1678)
  const shopEmail =
    (session as unknown as { email?: string }).email ?? null;
  const shopName = session.shop.replace(".myshopify.com", "");

  const shopRecord = await db.shop.upsert({
    where: { domain: session.shop },
    update: {
      accessToken: session.accessToken ?? "",
    },
    create: {
      domain: session.shop,
      accessToken: session.accessToken ?? "",
      email: shopEmail,
      name: shopName,
      installedAt: new Date(),
    },
  });

  // Link or provision Arcade account if not already linked
  if (!shopRecord.arcadeAccountId) {
    const arcadeAccountId = await resolveArcadeAccount({
      domain: shopRecord.domain,
      email: shopRecord.email,
      name: shopRecord.name,
      arcadeAccountId: shopRecord.arcadeAccountId,
    });

    if (arcadeAccountId) {
      await db.shop.update({
        where: { id: shopRecord.id },
        data: { arcadeAccountId },
      });
    }
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
