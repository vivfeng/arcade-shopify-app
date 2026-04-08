import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// ─── Loader ───

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const product = await db.arcadeProduct.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      status: true,
      shopifyProductGid: true,
      productType: { select: { name: true } },
    },
  });

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  // Strict: success URL is reserved for products that have actually been
  // published. Anything else gets bounced back to pricing/review so the
  // "Product Published!" copy is always truthful.
  if (product.status !== "ACTIVE") {
    throw redirect(`/app/design/${product.id}/pricing`);
  }

  return json({
    product: {
      id: product.id,
      displayName: product.title ?? product.productType.name,
      shopifyProductGid: product.shopifyProductGid,
    },
  });
};

// ─── Helpers ───

function gidToNumericId(gid: string | null): string | null {
  if (!gid) return null;
  const match = gid.match(/\/Product\/(\d+)$/);
  return match ? match[1] : null;
}

// ─── Styles ───

const s: Record<string, React.CSSProperties> = {
  outer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "70vh",
    background: "#f7f4f0",
    padding: "32px",
  },
  card: {
    width: 480,
    background: "#ffffff",
    borderRadius: 12,
    boxShadow: "0px 1px 4px 0px rgba(0,0,0,0.06)",
    padding: 48,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  checkBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    background: "#e8f8ed",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#2ca84f",
    fontFamily: "'Instrument Sans', sans-serif",
    fontWeight: 600,
    fontSize: 24,
  },
  headline: {
    margin: 0,
    fontFamily: "'Inter', sans-serif",
    fontWeight: 700,
    fontSize: 28,
    lineHeight: "30.8px",
    letterSpacing: "-0.56px",
    color: "#0f0f0f",
    textAlign: "center" as const,
  },
  subtext: {
    margin: 0,
    fontFamily: "'Instrument Sans', sans-serif",
    fontWeight: 400,
    fontSize: 14,
    lineHeight: "22px",
    color: "#696864",
    textAlign: "center" as const,
  },
  primaryCta: {
    height: 44,
    padding: "0 20px",
    background: "#0f0f0f",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontFamily: "'Instrument Sans', sans-serif",
    fontWeight: 500,
    fontSize: 14,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    cursor: "pointer",
  },
  secondaryCta: {
    height: 44,
    padding: "0 20px",
    background: "#ffffff",
    color: "#45413b",
    border: "1px solid #deddd5",
    borderRadius: 8,
    fontFamily: "'Instrument Sans', sans-serif",
    fontWeight: 500,
    fontSize: 14,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    cursor: "pointer",
  },
};

// ─── Presentational ───
//
// Exported so a non-auth preview route can render the same UI with mock data.

export interface SuccessCardProps {
  displayName: string;
  shopifyProductGid: string | null;
}

export function PublishSuccessCard({
  displayName,
  shopifyProductGid,
}: SuccessCardProps) {
  const numericId = gidToNumericId(shopifyProductGid);

  return (
    <div style={s.outer}>
      <div style={s.card} data-testid="success-card">
        <div style={s.checkBadge} aria-hidden="true">
          ✓
        </div>

        <h1 style={s.headline}>Product Published!</h1>

        <p style={s.subtext}>
          Your {displayName} is now live in your Shopify store.
        </p>

        {/* Primary CTA: Shopify admin link if GID present, otherwise fallback */}
        {numericId ? (
          <a
            href={`shopify://admin/products/${numericId}`}
            target="_top"
            style={s.primaryCta}
            data-testid="primary-cta-shopify"
          >
            View in Shopify Admin →
          </a>
        ) : (
          <Link
            to="/app/categories"
            style={s.primaryCta}
            data-testid="primary-cta-fallback"
          >
            Browse Categories →
          </Link>
        )}

        {/* Secondary CTA: always to categories */}
        <Link
          to="/app/categories"
          style={s.secondaryCta}
          data-testid="secondary-cta"
        >
          ✦ Create Another Product
        </Link>
      </div>
    </div>
  );
}

// ─── Route component ───

export default function PublishSuccess() {
  const { product } = useLoaderData<typeof loader>();

  return (
    <Page>
      <PublishSuccessCard
        displayName={product.displayName}
        shopifyProductGid={product.shopifyProductGid}
      />
    </Page>
  );
}
