import type { ActionFunctionArgs } from "react-router";
import { Prisma } from "@prisma/client";
import { authenticate } from "../../shopify.server";
import db from "../../db.server";
import { evictTokenCache } from "../../services/arcade/arcadeAuth.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    const shopRecord = await db.shop.findUnique({
      where: { domain: shop },
      select: { arcadeAccountId: true },
    });
    if (shopRecord?.arcadeAccountId) {
      evictTokenCache(shopRecord.arcadeAccountId);
    }
  } catch {
    console.error(`Shop ${shop} not found`);
  }

  try {
    await db.session.deleteMany({ where: { shop } });

    await db.shop.update({
      where: { domain: shop },
      data: { uninstalledAt: new Date() },
    });
  } catch (error) {
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
