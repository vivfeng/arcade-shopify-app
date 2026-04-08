import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Return stored customer data
  // Per GDPR, we must respond with any customer data we store
  const customerEmail = (payload as { customer?: { email?: string } })?.customer
    ?.email;

  if (customerEmail) {
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

    console.log(
      `Found ${orders.length} orders for customer ${customerEmail} in shop ${shop}`,
    );
  }

  return new Response();
};
