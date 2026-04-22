import {
  data,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  useLoaderData,
  useNavigate,
  useFetcher,
  Link,
} from "react-router";
import { AppPage } from "../../../components/layout/AppPage";
import { authenticate } from "../../../shopify.server";
import db from "../../../db.server";
import { formatPrice } from "../../../lib/format";
import { publishToShopify } from "../../../services/shopify/shopifyPublish.server";
import {
  enforceVariantRetailForChannel,
  markupPercentFromRetail,
} from "../../../lib/channelPricing";
import { useState, useCallback, useEffect } from "react";
import { LoadingCard } from "../../../components/ui/LoadingCard";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { PageShell } from "../../../components/layout/PageShell";
import { ArrowRight } from "lucide-react";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const product = await db.arcadeProduct.findFirst({
    where: {
      id: params.id,
      shop: { domain: session.shop },
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      imageUrls: true,
      shopifyProductGid: true,
      commissionRatePercent: true,
      productType: {
        select: {
          id: true,
          name: true,
          basePrice: true,
          sizeOptions: true,
          fabricOptions: true,
        },
      },
      variants: {
        select: {
          id: true,
          size: true,
          fabric: true,
          productCost: true,
          retailPrice: true,
          markupPercent: true,
        },
        orderBy: [{ size: "asc" }, { fabric: "asc" }],
      },
    },
  });

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  if (product.status === "ACTIVE") {
    throw redirect(`/app/design/${product.id}/success`);
  }

  let variants = product.variants;
  if (variants.length === 0) {
    const sizes = (product.productType.sizeOptions as string[]) ?? [];
    const fabrics = (product.productType.fabricOptions as string[]) ?? [];
    const basePrice = Number(product.productType.basePrice);
    const defaultMarkup = 40;
    const defaultRetail = basePrice * (1 + defaultMarkup / 100);

    const variantData = [];
    for (const size of sizes) {
      for (const fabric of fabrics) {
        variantData.push({
          size,
          fabric,
          productCost: basePrice,
          retailPrice: Math.round(defaultRetail * 100) / 100,
          markupPercent: defaultMarkup,
          arcadeProductId: product.id,
        });
      }
    }

    if (variantData.length > 0) {
      await db.productVariant.createMany({ data: variantData });

      variants = await db.productVariant.findMany({
        where: { arcadeProductId: product.id },
        select: {
          id: true,
          size: true,
          fabric: true,
          productCost: true,
          retailPrice: true,
          markupPercent: true,
        },
        orderBy: [{ size: "asc" }, { fabric: "asc" }],
      });
    }
  }

  const imageUrls = (product.imageUrls as string[]) ?? [];

  return data({
    product: {
      id: product.id,
      title: product.title ?? product.productType.name,
      description: product.description ?? "",
      status: product.status,
      imageUrls,
      productTypeName: product.productType.name,
      commissionRatePercent: Number(product.commissionRatePercent),
    },
    variants: variants.map((v) => ({
      id: v.id,
      size: v.size,
      fabric: v.fabric,
      productCost: Number(v.productCost),
      retailPrice: Number(v.retailPrice),
      markupPercent: Number(v.markupPercent),
    })),
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "update-price") {
    const variantId = formData.get("variantId") as string;
    const retailPrice = parseFloat(formData.get("retailPrice") as string);

    if (!variantId || isNaN(retailPrice) || retailPrice < 0) {
      return data({ error: "Invalid variant or price" }, { status: 400 });
    }

    const variant = await db.productVariant.findFirst({
      where: {
        id: variantId,
        arcadeProduct: {
          id: params.id,
          shop: { domain: session.shop },
        },
      },
      select: {
        productCost: true,
        arcadeProduct: { select: { commissionRatePercent: true } },
      },
    });

    if (!variant) {
      return data({ error: "Variant not found" }, { status: 404 });
    }

    const cost = Number(variant.productCost);
    const rate = Number(variant.arcadeProduct.commissionRatePercent);
    const enforced = enforceVariantRetailForChannel({
      productCost: cost,
      retailPrice,
      commissionRatePercent: rate,
    });

    const markupPercent = markupPercentFromRetail(cost, enforced.retailPrice);

    const updated = await db.productVariant.update({
      where: { id: variantId },
      data: {
        retailPrice: enforced.retailPrice,
        markupPercent,
      },
      select: {
        id: true,
        size: true,
        fabric: true,
        productCost: true,
        retailPrice: true,
        markupPercent: true,
      },
    });

    return data({
      variant: {
        id: updated.id,
        size: updated.size,
        fabric: updated.fabric,
        productCost: Number(updated.productCost),
        retailPrice: Number(updated.retailPrice),
        markupPercent: Number(updated.markupPercent),
      },
      pricingMessage: enforced.message,
    });
  }

  if (intent === "publish") {
    const product = await db.arcadeProduct.findFirst({
      where: {
        id: params.id,
        shop: { domain: session.shop },
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        imageUrls: true,
        shopifyProductGid: true,
        commissionRatePercent: true,
        productType: { select: { name: true } },
        variants: {
          select: {
            id: true,
            size: true,
            fabric: true,
            productCost: true,
            retailPrice: true,
          },
        },
        shop: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      return data({ error: "Product not found" }, { status: 404 });
    }

    if (product.shopifyProductGid) {
      return redirect(`/app/design/${product.id}/success`);
    }

    if (product.status === "PUBLISHING") {
      return data(
        { error: "This product is already being published. Please wait." },
        { status: 409 },
      );
    }

    const imageUrls = (product.imageUrls as string[]) ?? [];

    if (product.variants.length === 0) {
      return data(
        { error: "Cannot publish without variants. Please add pricing first." },
        { status: 400 },
      );
    }

    const rate = Number(product.commissionRatePercent);
    for (const v of product.variants) {
      const cost = Number(v.productCost);
      const enforced = enforceVariantRetailForChannel({
        productCost: cost,
        retailPrice: Number(v.retailPrice),
        commissionRatePercent: rate,
      });
      if (enforced.wasAdjusted) {
        await db.productVariant.update({
          where: { id: v.id },
          data: {
            retailPrice: enforced.retailPrice,
            markupPercent: markupPercentFromRetail(cost, enforced.retailPrice),
          },
        });
      }
    }

    const variantsForPublish = await db.productVariant.findMany({
      where: { arcadeProductId: product.id },
      select: { size: true, fabric: true, retailPrice: true },
      orderBy: [{ size: "asc" }, { fabric: "asc" }],
    });

    await db.arcadeProduct.update({
      where: { id: product.id },
      data: { status: "PUBLISHING" },
    });

    try {
      const result = await publishToShopify(admin.graphql, {
        title: product.title ?? product.productType.name,
        descriptionHtml: product.description ?? "",
        productTypeName: product.productType.name,
        vendor: "Arcade",
        imageUrls,
        variants: variantsForPublish.map((v) => ({
          size: v.size,
          fabric: v.fabric,
          retailPrice: String(v.retailPrice),
        })),
      });

      await db.arcadeProduct.update({
        where: { id: product.id },
        data: {
          shopifyProductGid: result.shopifyProductGid,
          status: "ACTIVE",
        },
      });

      return redirect(`/app/design/${product.id}/success`);
    } catch (err) {
      console.error("[BE-1681] Shopify publish failed:", err);

      await db.arcadeProduct.update({
        where: { id: product.id },
        data: { status: "DRAFT" },
      });

      const message =
        err instanceof Error ? err.message : "Unknown error publishing to Shopify";

      return data({ error: message }, { status: 500 });
    }
  }

  return data({ error: "Unknown intent" }, { status: 400 });
};

export default function PricingReview() {
  const { product, variants: initialVariants } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const publishFetcher = useFetcher<{ error?: string }>();
  const priceFetcher = useFetcher<{
    error?: string;
    pricingMessage?: string;
    variant?: {
      id: string;
      size: string;
      fabric: string;
      productCost: number;
      retailPrice: number;
      markupPercent: number;
    };
  }>();

  const [variants, setVariants] = useState(initialVariants);

  const isPublishing =
    publishFetcher.state !== "idle" || product.status === "PUBLISHING";
  const publishError =
    publishFetcher.data && "error" in publishFetcher.data
      ? publishFetcher.data.error
      : null;

  const priceAdjustMessage =
    priceFetcher.data && "pricingMessage" in priceFetcher.data
      ? priceFetcher.data.pricingMessage
      : null;

  const handlePriceChange = useCallback(
    (variantId: string, value: string) => {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue) || numericValue < 0) return;

      setVariants((prev) =>
        prev.map((v) => {
          if (v.id !== variantId) return v;
          const markup =
            v.productCost > 0
              ? Math.round(
                  ((numericValue - v.productCost) / v.productCost) * 10000,
                ) / 100
              : 0;
          return { ...v, retailPrice: numericValue, markupPercent: markup };
        }),
      );

      priceFetcher.submit(
        {
          intent: "update-price",
          variantId,
          retailPrice: value,
        },
        { method: "post" },
      );
    },
    [priceFetcher],
  );

  useEffect(() => {
    const v = priceFetcher.data?.variant;
    if (!v) return;
    setVariants((prev) =>
      prev.map((row) => (row.id === v.id ? { ...v } : row)),
    );
  }, [priceFetcher.data]);

  const handlePublish = useCallback(() => {
    if (isPublishing) return;
    publishFetcher.submit({ intent: "publish" }, { method: "post" });
  }, [isPublishing, publishFetcher]);

  return (
    <AppPage>
      <PageShell
        heading="Review & Pricing"
        subtitle={`Set your prices and publish ${product.title} to Shopify`}
        backLabel="Back"
        onBack={() => navigate(-1)}
      >
        {publishError && <ErrorBanner message={publishError} />}
        {priceAdjustMessage && <ErrorBanner message={priceAdjustMessage} />}

        {isPublishing && (
          <LoadingCard
            title="Publishing to Shopify…"
            subtitle="Uploading images and creating your product listing"
          />
        )}

        {/* Product preview card */}
        <div className="flex flex-col gap-4 rounded-xl border border-card-border bg-card p-5 shadow-card">
          <p className="m-0 text-sm font-semibold text-primary">{product.title}</p>
          <p className="m-0 text-sm text-subdued">{product.productTypeName}</p>

          {product.imageUrls.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto">
              {product.imageUrls.map((url, i) => (
                <img
                  key={url}
                  src={url}
                  alt={`Design ${i + 1}`}
                  className="size-20 shrink-0 rounded-lg object-cover border border-card-border"
                />
              ))}
            </div>
          ) : (
            <p className="m-0 text-[13px] text-subdued italic">
              No images generated yet — product will be published without images
            </p>
          )}
        </div>

        {/* Variant pricing table */}
        <div className="flex flex-col gap-4 rounded-xl border border-card-border bg-card p-5 shadow-card">
          <p className="m-0 text-sm font-semibold text-primary">Variant Pricing</p>

          <table className="w-full border-collapse table-fixed text-sm">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-subdued border-b border-card-border">Size</th>
                <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-subdued border-b border-card-border">Fabric</th>
                <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-subdued border-b border-card-border">Cost</th>
                <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-subdued border-b border-card-border">Retail Price</th>
                <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-subdued border-b border-card-border">Markup</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2.5 border-b border-card-border-soft text-primary align-middle">{v.size}</td>
                  <td className="px-3 py-2.5 border-b border-card-border-soft text-primary align-middle">{v.fabric}</td>
                  <td className="px-3 py-2.5 border-b border-card-border-soft text-primary align-middle">{formatPrice(v.productCost)}</td>
                  <td className="px-3 py-2.5 border-b border-card-border-soft align-middle">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-[90px] h-8 px-2 rounded-md border border-card-border text-sm text-primary text-right outline-none bg-transparent"
                      value={v.retailPrice.toFixed(2)}
                      onChange={(e) =>
                        handlePriceChange(v.id, e.target.value)
                      }
                      disabled={isPublishing}
                    />
                  </td>
                  <td className="px-3 py-2.5 border-b border-card-border-soft align-middle">
                    <span className="text-xs text-subdued">
                      {v.markupPercent >= 0 ? "+" : ""}
                      {v.markupPercent.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {variants.length === 0 && (
            <p className="m-0 text-[13px] text-subdued italic">
              No variants configured for this product type.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center gap-3">
          <Link
            to="/app/categories"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-card-border bg-card px-5 text-sm font-medium text-secondary no-underline"
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing || variants.length === 0}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-lg border-none bg-primary text-card text-sm font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPublishing ? "Publishing…" : "Publish to Shopify"}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </PageShell>
    </AppPage>
  );
}
