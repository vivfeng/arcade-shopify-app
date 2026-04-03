import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Clean up sessions
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Mark shop as uninstalled
  await db.shop
    .update({
      where: { domain: shop },
      data: { uninstalledAt: new Date() },
    })
    .catch(() => {
      // Shop record may not exist yet
    });

  return new Response();
};
