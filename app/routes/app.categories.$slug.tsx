import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

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
            color: "#988c52",
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "'Instrument Sans', sans-serif",
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
              color: "#0f0f0f",
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
              color: "#696864",
              fontFamily: "'Instrument Sans', sans-serif",
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
              background: "#ffffff",
              border: "1px solid #deddd5",
              borderRadius: 8,
              boxShadow: "0px 1px 4px 0px rgba(0,0,0,0.06)",
            }}
          >
            {/* Thumbnail */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 6,
                flexShrink: 0,
                background: "#e9e5d8",
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
                    color: "#0f0f0f",
                    fontFamily: "'Instrument Sans', sans-serif",
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
                      borderRadius: 4,
                      background: "#f3eec5",
                      color: "#988c52",
                      fontSize: 9,
                      fontFamily: "'DM Mono', monospace",
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
                    color: "#696864",
                    fontFamily: "'DM Mono', monospace",
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
                  color: "#0f0f0f",
                  fontFamily: "'Instrument Sans', sans-serif",
                  whiteSpace: "nowrap",
                }}
              >
                From ${Number(pt.basePrice).toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => navigate(`/app/design/prompt?type=${pt.slug}`)}
                style={{
                  height: 30,
                  padding: "0 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "#0f0f0f",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: "'Instrument Sans', sans-serif",
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
