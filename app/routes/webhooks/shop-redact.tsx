import type { ActionFunctionArgs } from "react-router";
import { Prisma } from "@prisma/client";
import { authenticate } from "../../shopify.server";
import db from "../../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
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
