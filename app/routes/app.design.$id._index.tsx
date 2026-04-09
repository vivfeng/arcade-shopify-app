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

  // Scope the lookup to the authenticated shop so merchants can only load
  // their own drafts. This is the multi-store safety rule documented in
  // docs/architecture.md.
  const product = await db.arcadeProduct.findFirst({
    where: {
      id: params.id,
      shop: { domain: session.shop },
    },
    select: {
      id: true,
      title: true,
      designPrompt: true,
      status: true,
      imageUrls: true,
      productType: {
        select: {
          id: true,
          name: true,
          basePrice: true,
          sizeOptions: true,
          fabricOptions: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
  });

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  return json({
    product: {
      ...product,
      basePrice: Number(product.productType.basePrice),
    },
  });
};

// ─── Action ───
//
// "Continue to pricing" handler. We keep the product in DRAFT and move
// forward in the flow; variant pricing is configured on the pricing screen.

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

  return redirect(`/app/design/${product.id}/pricing`);
};

// ─── Styles ───

const s: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    maxWidth: 960,
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
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
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
  imagePlaceholder: {
    width: "100%",
    aspectRatio: "1 / 1",
    background: "#e9e5d8",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#988c52",
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
  },
  label: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 10,
    color: "#696864",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  promptBox: {
    padding: 12,
    background: "#f7f4f0",
    borderRadius: 8,
    fontSize: 13,
    color: "#0f0f0f",
    fontFamily: "'Instrument Sans', sans-serif",
    whiteSpace: "pre-wrap" as const,
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

export default function DesignPdp() {
  const { product } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Page>
      <div style={s.container}>
        <button
          type="button"
          onClick={() => navigate(`/app/categories/${product.productType.category.slug}`)}
          style={s.backButton}
        >
          ← Back to {product.productType.category.name}
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={s.heading}>{product.title ?? product.productType.name}</h1>
          <p style={s.subtitle}>
            AI design generation is wired up in AII-826 — this is the draft view.
          </p>
        </div>

        <div style={s.layout}>
          {/* Imagery */}
          <div style={s.card}>
            <span style={s.label}>Preview</span>
            <div style={s.imagePlaceholder}>Design generation pending</div>
          </div>

          {/* Details */}
          <div style={s.card}>
            <div>
              <span style={s.label}>Product type</span>
              <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 500 }}>
                {product.productType.name}
              </p>
            </div>

            <div>
              <span style={s.label}>Base price</span>
              <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 500 }}>
                ${product.basePrice.toFixed(2)}
              </p>
            </div>

            {product.designPrompt && (
              <div>
                <span style={s.label}>Prompt</span>
                <div style={s.promptBox}>{product.designPrompt}</div>
              </div>
            )}

            <Form method="post">
              <button type="submit" style={s.primaryCta}>
                Continue to pricing →
              </button>
            </Form>
          </div>
        </div>
      </div>
    </Page>
  );
}
