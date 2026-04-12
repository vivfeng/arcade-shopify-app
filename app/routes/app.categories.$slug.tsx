import { data, type LoaderFunctionArgs, useLoaderData, useNavigate } from "react-router";
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

  return data({ category });
};

// First product type in each category gets a "Popular" badge
const POPULAR_LIMIT = 1;

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
          <div
            key={pt.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              height: 64,
              padding: "0 16px",
              background: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: radius.md,
              boxShadow: shadows.card,
            }}
          >
            {/* Thumbnail */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.sm,
                flexShrink: 0,
                background: colors.surfaceMuted,
                overflow: "hidden",
              }}
            >
              {pt.imageUrl && !pt.imageUrl.startsWith("/images/product-types/") && (
                <img
                  src={pt.imageUrl}
                  alt={pt.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              )}
            </div>

            {/* Name + specs */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: colors.textPrimary,
                    fontFamily: fonts.sans,
                    whiteSpace: "nowrap",
                  }}
                >
                  {pt.name}
                </span>
                {index < POPULAR_LIMIT && (
                  <span
                    style={{
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
                      whiteSpace: "nowrap",
                    }}
                  >
                    Popular
                  </span>
                )}
              </div>
              {pt.specs && (
                <span
                  style={{
                    fontSize: 10,
                    color: colors.textSubdued,
                    fontFamily: fonts.mono,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {pt.specs}
                </span>
              )}
            </div>

            {/* Price + CTA */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.textPrimary,
                  fontFamily: fonts.sans,
                  whiteSpace: "nowrap",
                }}
              >
                From {formatPrice(pt.basePrice)}
              </span>
              <button
                type="button"
                onClick={() => navigate(`/app/design/prompt?type=${pt.slug}`)}
                style={{
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
                  whiteSpace: "nowrap",
                }}
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
