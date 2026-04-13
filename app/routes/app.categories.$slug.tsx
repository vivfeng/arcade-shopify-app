import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { formatPrice } from "../lib/format";
import { colors, fonts, radius, shadows } from "../lib/tokens";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const { slug } = params;

  const category = await db.productCategory.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      productTypes: {
        select: {
          id: true,
          name: true,
          slug: true,
          specs: true,
          basePrice: true,
          imageUrl: true,
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!category) {
    throw new Response("Category not found", { status: 404 });
  }

  return json({ category });
};

// First product type in each category gets a "Popular" badge
const POPULAR_LIMIT = 1;

// Module-level style record for the product-type row. Extracted from
// the `.map()` loop so these static objects are allocated once at load
// rather than per-item per-render. Same pattern as `gridStyles` in
// app/routes/app.categories._index.tsx. Only per-item dynamic values
// (image URL, text content, conditional badge rendering) remain in JSX.
const rowStyles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    height: 64,
    padding: "0 16px",
    background: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radius.md,
    boxShadow: shadows.card,
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    flexShrink: 0,
    background: colors.surfaceMuted,
    overflow: "hidden",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 3,
  },
  infoTopRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: 500,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    whiteSpace: "nowrap" as const,
  },
  popularBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 18,
    padding: "0 6px",
    borderRadius: radius.xs,
    background: colors.goldPale,
    color: colors.gold,
    fontSize: 9,
    fontFamily: fonts.mono,
    whiteSpace: "nowrap" as const,
  },
  specs: {
    fontSize: 10,
    color: colors.textSubdued,
    fontFamily: fonts.mono,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  priceCol: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },
  price: {
    fontSize: 13,
    fontWeight: 600,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    whiteSpace: "nowrap" as const,
  },
  designButton: {
    height: 30,
    padding: "0 12px",
    borderRadius: radius.sm,
    border: "none",
    background: colors.textPrimary,
    color: colors.cardBg,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: fonts.sans,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
};

export default function CategoryProductTypes() {
  const { category } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const singularName = category.name.toLowerCase().replace(/s$/, "");

  return (
    <Page>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate("/app/categories")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: colors.gold,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: fonts.sans,
          }}
        >
          ← Back to Categories
        </button>

        {/* Heading */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              color: colors.textPrimary,
              letterSpacing: "-0.52px",
              lineHeight: "28.6px",
            }}
          >
            {category.name}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: colors.textSubdued,
              fontFamily: fonts.sans,
            }}
          >
            Choose a {singularName} style to start designing
          </p>
        </div>

        {/* Product type rows */}
        {category.productTypes.map((pt, index) => (
          <div key={pt.id} style={rowStyles.row}>
            {/* Thumbnail */}
            <div style={rowStyles.thumbnail}>
              {pt.imageUrl && !pt.imageUrl.startsWith("/images/product-types/") && (
                <img
                  src={pt.imageUrl}
                  alt={pt.name}
                  style={rowStyles.thumbnailImage}
                />
              )}
            </div>

            {/* Name + specs */}
            <div style={rowStyles.infoCol}>
              <div style={rowStyles.infoTopRow}>
                <span style={rowStyles.productName}>{pt.name}</span>
                {index < POPULAR_LIMIT && (
                  <span style={rowStyles.popularBadge}>Popular</span>
                )}
              </div>
              {pt.specs && <span style={rowStyles.specs}>{pt.specs}</span>}
            </div>

            {/* Price + CTA */}
            <div style={rowStyles.priceCol}>
              <span style={rowStyles.price}>
                From {formatPrice(pt.basePrice)}
              </span>
              <button
                type="button"
                onClick={() => navigate(`/app/design/prompt?type=${pt.slug}`)}
                style={rowStyles.designButton}
              >
                Design
              </button>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
