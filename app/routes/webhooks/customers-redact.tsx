import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../../shopify.server";
import db from "../../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Delete customer personal data from our orders
  const customerEmail = (payload as { customer?: { email?: string } })?.customer
    ?.email;

  if (customerEmail) {
    await db.arcadeOrder.updateMany({
      where: {
        customerEmail,
        shop: { domain: shop },
      },
      data: {
        customerName: "[REDACTED]",
        customerEmail: "[REDACTED]",
      },
    });

    console.log(`Redacted customer data for ${customerEmail} in shop ${shop}`);
  }

  return new Response();
};
