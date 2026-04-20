import db from "../../db.server";
import {
  enforceVariantRetailForChannel,
  markupPercentFromRetail,
} from "../../lib/channelPricing";

interface AdminGraphql {
  (query: string, options?: { variables?: Record<string, unknown> }): Promise<Response>;
}

const VARIANT_UPDATE = `#graphql
  mutation productVariantUpdate($input: ProductVariantInput!) {
    productVariantUpdate(input: $input) {
      productVariant {
        id
        price
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type RestVariant = {
  id?: number;
  price?: string;
  option1?: string | null;
  option2?: string | null;
  admin_graphql_api_id?: string | null;
};

type RestProductPayload = {
  id?: number;
  variants?: RestVariant[];
};

/**
 * After a `products/update` webhook, clamp any variant price below our DB floor
 * back up to the lawful minimum (via Admin GraphQL).
 */
export async function clampPublishedProductVariantPricesFromWebhook(params: {
  graphql: AdminGraphql;
  shopDomain: string;
  productPayload: RestProductPayload;
}): Promise<void> {
  const productId = params.productPayload.id;
  if (!productId) return;

  const shopifyProductGid = `gid://shopify/Product/${productId}`;

  const arcadeProduct = await db.arcadeProduct.findFirst({
    where: {
      shop: { domain: params.shopDomain },
      shopifyProductGid,
    },
    select: {
      id: true,
      commissionRatePercent: true,
      variants: {
        select: {
          id: true,
          size: true,
          fabric: true,
          productCost: true,
          retailPrice: true,
        },
      },
    },
  });

  if (!arcadeProduct || arcadeProduct.variants.length === 0) {
    return;
  }

  const rate = Number(arcadeProduct.commissionRatePercent);
  const variants = params.productPayload.variants ?? [];

  for (const sv of variants) {
    const priceNum = Number.parseFloat(String(sv.price ?? ""));
    if (!Number.isFinite(priceNum)) continue;

    const size = (sv.option1 ?? "").trim();
    const fabric = (sv.option2 ?? "").trim();
    const match = arcadeProduct.variants.find(
      (v) => v.size === size && v.fabric === fabric,
    );
    if (!match) continue;

    const base = Number(match.productCost);
    const { retailPrice: lawful, wasAdjusted } = enforceVariantRetailForChannel({
      productCost: base,
      retailPrice: priceNum,
      commissionRatePercent: rate,
    });

    if (!wasAdjusted && priceNum >= lawful - 1e-6) continue;

    const gid =
      sv.admin_graphql_api_id ?? `gid://shopify/ProductVariant/${sv.id}`;
    if (!gid) continue;

    const res = await params.graphql(VARIANT_UPDATE, {
      variables: {
        input: {
          id: gid,
          price: lawful.toFixed(2),
        },
      },
    });
    const json = await res.json();
    const errs = json.data?.productVariantUpdate?.userErrors;
    if (errs?.length) {
      console.warn(
        `[shopifyVariantPriceGuard] productVariantUpdate userErrors for ${gid}:`,
        errs,
      );
    }

    await db.productVariant.update({
      where: { id: match.id },
      data: {
        retailPrice: lawful,
        markupPercent: markupPercentFromRetail(base, lawful),
      },
    });
  }
}
