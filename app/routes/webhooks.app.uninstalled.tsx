import type { ActionFunctionArgs } from "react-router";
import { Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Shopify webhook: APP_UNINSTALLED.
 *
 * Fires immediately when a merchant removes the app from their store.
 * This is the cleanup pass — the GDPR `shop/redact` webhook arrives
 * 48h later and does the destructive delete; here we just disarm the
 * shop record so nothing else in the app can keep using its session.
 *
 * Idempotency: ports the pattern from `webhooks.shop.redact.tsx`
 * (FE-4134). Shopify can re-deliver any webhook; if the shop row is
 * already absent we treat it as success rather than letting Shopify
 * retry indefinitely. Every other Prisma error re-throws so real
 * failures surface in logs and trigger Shopify's retry path instead
 * of being silently swallowed (the previous handler used a bare
 * `.catch(() => {})` which masked everything).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    // Unconditionally remove every Session for this shop domain.
    // The previous handler gated this on the current-session object
    // being truthy, which is unrelated to whether orphan sessions
    // exist for this shop and could leak rows across reinstalls.
    await db.session.deleteMany({ where: { shop } });

    await db.shop.update({
      where: { domain: shop },
      data: {
        uninstalledAt: new Date(),
        // Clear the access token so a stale row can't be replayed
        // by any future handler that still resolves the shop by
        // domain (e.g. a delayed webhook arriving after uninstall).
        accessToken: "",
      },
    });
  } catch (error) {
    // P2025 = "record to update does not exist". The Shop row may not
    // have been created yet (partial install) or may have already
    // been redacted; treat as idempotent success.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      console.log(
        `Shop ${shop} not present in DB — idempotent uninstall success`,
      );
      return new Response();
    }
    throw error;
  }

  return new Response();
};
