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
import { Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { colors, fonts, radius, shadows } from "../lib/tokens";
import { formatPrice } from "../lib/format";
import { publishToShopify } from "../lib/shopifyPublish.server";
import { useState, useCallback } from "react";

// ─── Loader ───

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const product = await db.arcadeProduct.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      imageUrls: true,
      shopifyProductGid: true,
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

  // Already published — go to success
  if (product.status === "ACTIVE") {
    throw redirect(`/app/design/${product.id}/success`);
  }

  // Seed default variants if none exist yet
  let variants = product.variants;
  if (variants.length === 0) {
    const sizes = (product.productType.sizeOptions as string[]) ?? [];
    const fabrics = (product.productType.fabricOptions as string[]) ?? [];
    const basePrice = Number(product.productType.basePrice);
    const defaultMarkup = 40; // 40% default markup
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

      // Re-fetch seeded variants
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

// ─── Action ───

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  // ── Update a single variant's retail price ──
  if (intent === "update-price") {
    const variantId = formData.get("variantId") as string;
    const retailPrice = parseFloat(formData.get("retailPrice") as string);

    if (!variantId || isNaN(retailPrice) || retailPrice < 0) {
      return data({ error: "Invalid variant or price" }, { status: 400 });
    }

    const variant = await db.productVariant.findUnique({
      where: { id: variantId },
      select: { productCost: true },
    });

    if (!variant) {
      return data({ error: "Variant not found" }, { status: 404 });
    }

    const cost = Number(variant.productCost);
    const markupPercent =
      cost > 0 ? Math.round(((retailPrice - cost) / cost) * 10000) / 100 : 0;

    const updated = await db.productVariant.update({
      where: { id: variantId },
      data: { retailPrice, markupPercent },
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
    });
  }

  // ── Publish to Shopify ──
  if (intent === "publish") {
    const product = await db.arcadeProduct.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        imageUrls: true,
        shopifyProductGid: true,
        productType: { select: { name: true } },
        variants: {
          select: {
            size: true,
            fabric: true,
            retailPrice: true,
          },
        },
        shop: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      return data({ error: "Product not found" }, { status: 404 });
    }

    // Already published
    if (product.shopifyProductGid) {
      return redirect(`/app/design/${product.id}/success`);
    }

    // Prevent double-submit
    if (product.status === "PUBLISHING") {
      return data(
        { error: "This product is already being published. Please wait." },
        { status: 409 },
      );
    }

    const imageUrls = (product.imageUrls as string[]) ?? [];

    // Validate
    if (product.variants.length === 0) {
      return data(
        { error: "Cannot publish without variants. Please add pricing first." },
        { status: 400 },
      );
    }

    // Optimistic lock: set PUBLISHING
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
        variants: product.variants.map((v) => ({
          size: v.size,
          fabric: v.fabric,
          retailPrice: String(v.retailPrice),
        })),
      });

      // Success: save GID + flip to ACTIVE
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

      // Revert to DRAFT on failure
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

// ─── Styles ───

const s: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxWidth: 800,
  },
  backButton: {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color: colors.gold,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: fonts.sans,
  },
  heading: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: colors.textPrimary,
    letterSpacing: "-0.52px",
    lineHeight: "28.6px",
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    color: colors.textSubdued,
    fontFamily: fonts.sans,
  },
  card: {
    background: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radius.lg,
    boxShadow: shadows.card,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  sectionLabel: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
  },
  // Image preview
  imageRow: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
  },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    objectFit: "cover" as const,
    border: `1px solid ${colors.cardBorder}`,
    flexShrink: 0,
  },
  noImages: {
    margin: 0,
    fontSize: 13,
    color: colors.textSubdued,
    fontFamily: fonts.sans,
    fontStyle: "italic",
  },
  // Table
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontFamily: fonts.sans,
    fontSize: 14,
  },
  th: {
    textAlign: "left" as const,
    padding: "8px 12px",
    fontWeight: 600,
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    color: colors.textSubdued,
    borderBottom: `1px solid ${colors.cardBorder}`,
  },
  td: {
    padding: "10px 12px",
    borderBottom: `1px solid ${colors.cardBorderSoft}`,
    color: colors.textPrimary,
  },
  priceInput: {
    width: 90,
    height: 32,
    padding: "0 8px",
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radius.sm,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textPrimary,
    outline: "none",
    textAlign: "right" as const,
  },
  markup: {
    fontSize: 12,
    color: colors.textSubdued,
  },
  // Actions
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  publishButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 44,
    padding: "0 24px",
    borderRadius: radius.md,
    border: "none",
    background: colors.textPrimary,
    color: colors.cardBg,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.sans,
    cursor: "pointer",
  },
  publishButtonDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  secondaryButton: {
    height: 44,
    padding: "0 20px",
    background: colors.cardBg,
    color: colors.textSecondary,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radius.md,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: fonts.sans,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: radius.lg,
    padding: 16,
  },
  errorText: {
    margin: 0,
    fontSize: 14,
    lineHeight: "22px",
    color: "#991b1b",
    fontFamily: fonts.sans,
  },
  // Publishing state
  publishingCard: {
    background: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radius.lg,
    boxShadow: shadows.card,
    padding: 40,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 12,
  },
  spinner: {
    width: 32,
    height: 32,
    border: `3px solid ${colors.surfaceMuted}`,
    borderTopColor: colors.gold,
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  publishingText: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
  },
  publishingSubtext: {
    margin: 0,
    fontSize: 13,
    color: colors.textSubdued,
    fontFamily: fonts.sans,
  },
};

// ─── Component ───

export default function PricingReview() {
  const { product, variants: initialVariants } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const publishFetcher = useFetcher<{ error?: string }>();
  const priceFetcher = useFetcher();

  const [variants, setVariants] = useState(initialVariants);

  const isPublishing =
    publishFetcher.state !== "idle" || product.status === "PUBLISHING";
  const publishError =
    publishFetcher.data && "error" in publishFetcher.data
      ? publishFetcher.data.error
      : null;

  // ── Price update handler ──
  const handlePriceChange = useCallback(
    (variantId: string, value: string) => {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue) || numericValue < 0) return;

      // Optimistic UI update
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

      // Persist to DB
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

  // ── Publish handler ──
  const handlePublish = useCallback(() => {
    if (isPublishing) return;
    publishFetcher.submit({ intent: "publish" }, { method: "post" });
  }, [isPublishing, publishFetcher]);

  return (
    <Page>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={s.container}>
        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate(`/app/design/${product.id}/pricing`)}
          style={s.backButton}
          // Navigate back to prompt (product's design page)
          // For now back goes to categories
          onClickCapture={(e) => {
            e.preventDefault();
            navigate(-1);
          }}
        >
          ← Back
        </button>

        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={s.heading}>Review & Pricing</h1>
          <p style={s.subtitle}>
            Set your prices and publish {product.title} to Shopify
          </p>
        </div>

        {/* Error banner */}
        {publishError && (
          <div style={s.errorBanner}>
            <p style={s.errorText}>{publishError}</p>
          </div>
        )}

        {/* Publishing state overlay */}
        {isPublishing && (
          <div style={s.publishingCard}>
            <div style={s.spinner} />
            <p style={s.publishingText}>Publishing to Shopify…</p>
            <p style={s.publishingSubtext}>
              Uploading images and creating your product listing
            </p>
          </div>
        )}

        {/* Product preview card */}
        <div style={s.card}>
          <p style={s.sectionLabel}>{product.title}</p>
          <p style={{ ...s.subtitle, margin: 0 }}>
            {product.productTypeName}
          </p>

          {/* Image preview */}
          {product.imageUrls.length > 0 ? (
            <div style={s.imageRow}>
              {product.imageUrls.map((url, i) => (
                <img
                  key={url}
                  src={url}
                  alt={`Design ${i + 1}`}
                  style={s.imageThumb}
                />
              ))}
            </div>
          ) : (
            <p style={s.noImages}>
              No images generated yet — product will be published without images
            </p>
          )}
        </div>

        {/* Variant pricing table */}
        <div style={s.card}>
          <p style={s.sectionLabel}>Variant Pricing</p>

          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Size</th>
                <th style={s.th}>Fabric</th>
                <th style={s.th}>Cost</th>
                <th style={s.th}>Retail Price</th>
                <th style={s.th}>Markup</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id}>
                  <td style={s.td}>{v.size}</td>
                  <td style={s.td}>{v.fabric}</td>
                  <td style={s.td}>{formatPrice(v.productCost)}</td>
                  <td style={s.td}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      style={s.priceInput}
                      value={v.retailPrice.toFixed(2)}
                      onChange={(e) =>
                        handlePriceChange(v.id, e.target.value)
                      }
                      disabled={isPublishing}
                    />
                  </td>
                  <td style={s.td}>
                    <span style={s.markup}>
                      {v.markupPercent >= 0 ? "+" : ""}
                      {v.markupPercent.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {variants.length === 0 && (
            <p style={s.noImages}>
              No variants configured for this product type.
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={s.footer}>
          <Link
            to={`/app/categories`}
            style={s.secondaryButton}
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing || variants.length === 0}
            style={{
              ...s.publishButton,
              ...(isPublishing || variants.length === 0
                ? s.publishButtonDisabled
                : {}),
            }}
          >
            {isPublishing ? "Publishing…" : "Publish to Shopify →"}
          </button>
        </div>
      </div>
    </Page>
  );
}
