import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Shopify GDPR webhook: CUSTOMERS_DATA_REQUEST.
 *
 * Fires when a merchant's customer (or the merchant on their behalf)
 * exercises their GDPR right of access. Shopify gives us 30 days to
 * deliver any stored personal data for that customer back to the
 * merchant, who then forwards it to the requesting customer.
 *
 * What this app stores about end customers (as of 2026-04-09):
 * - `ArcadeOrder.customerName`
 * - `ArcadeOrder.customerEmail`
 * Nothing else. We do not store addresses, payment details, browsing
 * history, or any inferred profile data — Shopify holds all of that.
 *
 * Delivery model (MVP, manual): the handler logs a structured record
 * to the application log so an operator can grep for the matching
 * shop + email pair, export the rows, and forward them to the merchant
 * over a secure channel. There is intentionally no auto-email or admin
 * UI — the volume is expected to be near-zero for v1, and Shopify's
 * App Store reviewers have accepted documented manual processes from
 * comparable apps. See `docs/gdpr-webhook-test-plan.md` for the
 * end-to-end exercise reviewers run.
 *
 * If/when this app starts storing additional customer PII (shipping
 * addresses, phone numbers, gift messages, etc.), the lookup below
 * MUST be expanded in the same commit as the schema change. The
 * handler is the source of truth for "what we know about a customer."
 *
 * Idempotency: this handler is read-only by design, so duplicate
 * Shopify deliveries are inherently safe — we always return 200.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const customerEmail = (payload as { customer?: { email?: string } })?.customer
    ?.email;

  if (!customerEmail) {
    console.log(
      `[gdpr:data_request] ${shop}: payload missing customer.email — nothing to look up`,
    );
    return new Response();
  }

  const orders = await db.arcadeOrder.findMany({
    where: {
      customerEmail,
      shop: { domain: shop },
    },
    select: {
      shopifyOrderId: true,
      shopifyOrderNumber: true,
      customerName: true,
      customerEmail: true,
      totalPrice: true,
      createdAt: true,
    },
  });

  if (orders.length === 0) {
    console.log(
      `[gdpr:data_request] ${shop} / ${customerEmail}: no stored orders — nothing to deliver`,
    );
    return new Response();
  }

  // Structured single-line record so operators can grep the log
  // (or pipe to jq) and forward the result to the merchant.
  console.log(
    `[gdpr:data_request] ${shop} / ${customerEmail}: ${JSON.stringify({
      shop,
      customerEmail,
      recordCount: orders.length,
      orders,
    })}`,
  );

  return new Response();
};
