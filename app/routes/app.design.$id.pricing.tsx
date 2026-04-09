import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigate } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// ─── Loader ───

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (!params.id) {
    throw new Response("Missing product id", { status: 400 });
  }

  // Scope to the authenticated shop. See docs/architecture.md for the
  // multi-store safety rule (never resolve shop via findFirst).
  const product = await db.arcadeProduct.findFirst({
    where: {
      id: params.id,
      shop: { domain: session.shop },
    },
    select: {
      id: true,
      title: true,
      status: true,
      productType: {
        select: { name: true, basePrice: true },
      },
    },
  });

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  return json({
    product: {
      id: product.id,
      title: product.title,
      status: product.status,
      productTypeName: product.productType.name,
      basePrice: Number(product.productType.basePrice),
    },
  });
};

// ─── Action ───
//
// Publish stub: flips the product to ACTIVE and redirects to the success
// route. The actual Shopify productCreate call is tracked in SHOP-42 and
// must also create variants based on the pricing table on this screen.

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (!params.id) {
    throw new Response("Missing product id", { status: 400 });
  }

  const product = await db.arcadeProduct.findFirst({
    where: {
      id: params.id,
      shop: { domain: session.shop },
    },
    select: { id: true },
  });

  if (!product) {
    return json({ error: "Product not found" }, { status: 404 });
  }

  // TODO(SHOP-42): call admin.graphql productCreate, persist shopifyProductGid,
  // and only then flip status to ACTIVE.
  await db.arcadeProduct.update({
    where: { id: product.id },
    data: { status: "ACTIVE" },
  });

  return redirect(`/app/design/${product.id}/success`);
};

// ─── Styles ───

const s: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    maxWidth: 720,
  },
  backButton: {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color: "#988c52",
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "'Instrument Sans', sans-serif",
  },
  heading: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: "#0f0f0f",
    letterSpacing: "-0.52px",
    lineHeight: "28.6px",
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    color: "#696864",
    fontFamily: "'Instrument Sans', sans-serif",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #deddd5",
    borderRadius: 12,
    boxShadow: "0px 1px 4px 0px rgba(0,0,0,0.06)",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  label: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    color: "#696864",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
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
    cursor: "pointer",
    alignSelf: "flex-start" as const,
  },
};

// ─── Component ───

export default function PricingReview() {
  const { product } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Page>
      <div style={s.container}>
        <button
          type="button"
          onClick={() => navigate(`/app/design/${product.id}`)}
          style={s.backButton}
        >
          ← Back to design
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={s.heading}>Review & Publish</h1>
          <p style={s.subtitle}>
            Per-variant pricing table lands in SHOP-41. For now, publish uses the
            base price on the product type.
          </p>
        </div>

        <div style={s.card}>
          <div>
            <span style={s.label}>Title</span>
            <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 500 }}>
              {product.title ?? product.productTypeName}
            </p>
          </div>

          <div>
            <span style={s.label}>Base price</span>
            <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 500 }}>
              ${product.basePrice.toFixed(2)}
            </p>
          </div>

          <div>
            <span style={s.label}>Status</span>
            <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 500 }}>
              {product.status}
            </p>
          </div>

          <Form method="post">
            <button type="submit" style={s.primaryCta}>
              Publish to store →
            </button>
          </Form>
        </div>
      </div>
    </Page>
  );
}
