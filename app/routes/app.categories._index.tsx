import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

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
    background: "#f7f4f0",
    minHeight: "100vh",
    padding: "28px 32px 48px",
  },
  title: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontWeight: 600,
    fontSize: 22,
    color: "#0f0f0f",
    margin: 0,
    lineHeight: "normal",
  },
  subtitle: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontWeight: 400,
    fontSize: 13,
    color: "#696864",
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
    background: "#ffffff",
    border: "1px solid #e1dfdb",
    borderRadius: 8,
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
    background: "#e9e5d8",
  },
  label: {
    padding: "10px 12px",
  },
  labelText: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontWeight: 500,
    fontSize: 13,
    color: "#0f0f0f",
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
              e.currentTarget.style.borderColor = "#c5c2bc";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e1dfdb";
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
