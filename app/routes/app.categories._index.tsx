import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { colors, fonts, radius } from "../lib/tokens";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const categories = await db.productCategory.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
    },
  });

  return json({ categories });
};

const gridStyles: Record<string, React.CSSProperties> = {
  page: {
    background: colors.pageBg,
    minHeight: "100vh",
    padding: "28px 32px 48px",
  },
  title: {
    fontFamily: fonts.sans,
    fontWeight: 600,
    fontSize: 22,
    color: colors.textPrimary,
    margin: 0,
    lineHeight: "normal",
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontWeight: 400,
    fontSize: 13,
    color: colors.textSubdued,
    margin: "6px 0 0",
    lineHeight: "normal",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginTop: 20,
  },
  card: {
    all: "unset" as const,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column" as const,
    background: colors.cardBg,
    border: `1px solid ${colors.cardBorderSoft}`,
    borderRadius: radius.md,
    overflow: "hidden",
    transition: "border-color 150ms ease",
    boxSizing: "border-box" as const,
  },
  imageArea: {
    width: "100%",
    aspectRatio: "242 / 138",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    background: colors.surfaceMuted,
  },
  label: {
    padding: "10px 12px",
  },
  labelText: {
    fontFamily: fonts.sans,
    fontWeight: 500,
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: "normal",
  },
};

export default function CategoriesIndex() {
  const { categories } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div style={gridStyles.page}>
      <Link to="/app" style={{ textDecoration: "none" }}>
        <h1 style={gridStyles.title}>Arcade</h1>
      </Link>
      <p style={gridStyles.subtitle}>
        Design custom products with AI — browse categories to get started
      </p>

      <div style={gridStyles.grid}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => navigate(`/app/categories/${cat.slug}`)}
            style={gridStyles.card}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.cardBorderHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.cardBorderSoft;
            }}
          >
            <div style={gridStyles.imageArea}>
              {cat.imageUrl ? (
                <img
                  src={cat.imageUrl}
                  alt={cat.name}
                  style={gridStyles.image}
                />
              ) : (
                <div style={gridStyles.imagePlaceholder} />
              )}
            </div>
            <div style={gridStyles.label}>
              <span style={gridStyles.labelText}>{cat.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
