import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Delete all shop data (called 48h after app/uninstalled)
  const shopRecord = await db.shop.findUnique({ where: { domain: shop } });

  if (shopRecord) {
    // Delete in order of dependencies
    await db.productVariant.deleteMany({
      where: { arcadeProduct: { shopId: shopRecord.id } },
    });
    await db.arcadeProduct.deleteMany({ where: { shopId: shopRecord.id } });
    await db.arcadeOrder.deleteMany({ where: { shopId: shopRecord.id } });
    await db.shop.delete({ where: { id: shopRecord.id } });

    console.log(`Deleted all data for shop ${shop}`);
  }

  return new Response();
};
