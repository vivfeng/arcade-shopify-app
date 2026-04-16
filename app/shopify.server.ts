import "@shopify/shopify-app-react-router/adapters/node";
import {
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { ApiVersion } from "@shopify/shopify-api";
import db from "./db.server";
import { env } from "./lib/env/env.server";

const shopify = shopifyApp({
  apiKey: env.SHOPIFY_API_KEY,
  apiSecretKey: env.SHOPIFY_API_SECRET,
  apiVersion: ApiVersion.January26,
  scopes: env.SCOPES.split(","),
  appUrl: env.SHOPIFY_APP_URL ?? "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(db),
  distribution: AppDistribution.AppStore,
  ...(env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
