import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../../shopify.server";
import db from "../../db.server";

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
