import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Form, useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Text,
  BlockStack,
  InlineGrid,
  Button,
  Card,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({
    where: { domain: session.shop },
    select: { onboardingComplete: true },
  });

  const categories = await db.productCategory.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
    },
  });

  return json({
    onboardingComplete: shop?.onboardingComplete ?? false,
    categories,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  await db.shop.update({
    where: { domain: session.shop },
    data: { onboardingComplete: true },
  });

  return redirect("/app");
};

const STEPS = [
  {
    number: "1",
    title: "Browse & Choose",
    description:
      "Explore 13 home textile categories and pick a product type to customize.",
  },
  {
    number: "2",
    title: "Design with AI",
    description:
      "Describe your vision and let AI generate unique product designs instantly.",
  },
  {
    number: "3",
    title: "Publish & Sell",
    description:
      "Set your price, push to your Shopify store, and start selling — we handle fulfillment.",
  },
];

const VALUE_PROPS = [
  "AI Design",
  "1M+ SKUs on Arcade",
  "Auto-Fulfillment",
  "No Upfront Cost",
];

function WelcomeScreen() {
  return (
    <Page>
      <div
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          padding: "40px 0",
          textAlign: "center",
        }}
      >
        <BlockStack gap="600">
          {/* Logo */}
          <div>
            <img
              src="/arcade-logo.svg"
              alt="Arcade"
              style={{ height: "40px" }}
            />
          </div>

          {/* Headline + Subtext */}
          <BlockStack gap="300">
            <Text as="h1" variant="headingXl" fontWeight="bold">
              Turn thoughts into things
            </Text>
            <Text as="p" variant="bodyLg" tone="subdued">
              Arcade is the world's first AI product creation platform. Design
              custom products with AI and sell them in your Shopify store — no
              inventory, no upfront costs.
            </Text>
          </BlockStack>

          {/* Value Prop Chips */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {VALUE_PROPS.map((prop) => (
              <Badge key={prop} tone="info">
                {prop}
              </Badge>
            ))}
          </div>

          {/* CTAs */}
          <BlockStack gap="200">
            <Form method="post">
              <Button variant="primary" size="large" submit>
                Get Started
              </Button>
            </Form>
            <Button
              variant="plain"
              url="https://arcade.ai"
              external
            >
              Learn more about Arcade
            </Button>
          </BlockStack>

          {/* How It Works */}
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              How it works
            </Text>
            <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
              {STEPS.map((step) => (
                <Card key={step.number}>
                  <BlockStack gap="200">
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "var(--p-color-bg-fill-brand)",
                        color: "var(--p-color-text-on-fill)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                        fontSize: "14px",
                        margin: "0 auto",
                      }}
                    >
                      {step.number}
                    </div>
                    <Text as="h3" variant="headingSm" alignment="center">
                      {step.title}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                      {step.description}
                    </Text>
                  </BlockStack>
                </Card>
              ))}
            </InlineGrid>
          </BlockStack>
        </BlockStack>
      </div>
    </Page>
  );
}

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

function CategoryGrid() {
  const { categories } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div style={gridStyles.page}>
      <h1 style={gridStyles.title}>Arcade</h1>
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

export default function Index() {
  const { onboardingComplete } = useLoaderData<typeof loader>();

  if (!onboardingComplete) {
    return <WelcomeScreen />;
  }

  return <CategoryGrid />;
}
