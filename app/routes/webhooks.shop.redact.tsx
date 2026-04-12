import type { ActionFunctionArgs } from "react-router";
import { Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Shopify GDPR webhook: SHOP_REDACT.
 * Fires 48h after a merchant uninstalls the app and requests all of
 * their shop data be deleted. Must delete every row derived from the
 * shop atomically — a partial delete leaves the database in an
 * inconsistent state and is itself a GDPR violation.
 *
 * Idempotency: Shopify may deliver the same webhook more than once.
 * If the shop row is already gone we return 200 without raising.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    // All four deletes run in a single transaction. Order matters
    // because ProductVariant depends on ArcadeProduct and both depend
    // on Shop — the transaction guarantees we either wipe everything
    // or roll back cleanly if any step fails.
    await db.$transaction([
      db.productVariant.deleteMany({
        where: { arcadeProduct: { shop: { domain: shop } } },
      }),
      db.arcadeProduct.deleteMany({
        where: { shop: { domain: shop } },
      }),
      db.arcadeOrder.deleteMany({
        where: { shop: { domain: shop } },
      }),
      db.shop.delete({
        where: { domain: shop },
      }),
    ]);

    console.log(`Deleted all data for shop ${shop}`);
  } catch (error) {
    // P2025 = "record to delete does not exist". Webhook may have
    // already been processed; treat as idempotent success rather
    // than letting Shopify retry indefinitely.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      console.log(`Shop ${shop} already redacted — idempotent success`);
      return new Response();
    }
    throw error;
  }

  return new Response();
};
