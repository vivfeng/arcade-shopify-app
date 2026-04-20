import type { ActionFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../../shopify.server";
import { clampPublishedProductVariantPricesFromWebhook } from "../../services/shopify/shopifyVariantPriceGuard.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }

  try {
    const { admin } = await unauthenticated.admin(shop);
    await clampPublishedProductVariantPricesFromWebhook({
      graphql: admin.graphql,
      shopDomain: shop,
      productPayload: payload,
    });
  } catch (e) {
    console.error(`[webhooks/products-update] shop=${shop}`, e);
  }

  return new Response();
};
