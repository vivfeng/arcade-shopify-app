import {
  data,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  Form,
  useLoaderData,
  useNavigate,
} from "react-router";
import {
  Page,
  Text,
  BlockStack,
  InlineGrid,
  Button,
  Card,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../../shopify.server";
import db from "../../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({
    where: { domain: session.shop },
    select: { onboardingComplete: true },
  });

  return data({
    onboardingComplete: shop?.onboardingComplete ?? false,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  await db.shop.update({
    where: { domain: session.shop },
    data: { onboardingComplete: true },
  });

  return redirect("/app/categories");
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

export default function Home() {
  const { onboardingComplete } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Page>
      <div className="mx-auto max-w-[640px] py-10 text-center">
        <BlockStack gap="600">
          <div>
            <img src="/arcade-logo.svg" alt="Arcade" className="h-10" />
          </div>

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

          <div className="flex justify-center flex-wrap gap-2">
            {VALUE_PROPS.map((prop) => (
              <Badge key={prop} tone="info">
                {prop}
              </Badge>
            ))}
          </div>

          <BlockStack gap="200">
            {!onboardingComplete ? (
              <Form method="post">
                <Button variant="primary" size="large" submit>
                  Get Started
                </Button>
              </Form>
            ) : (
              <Button
                variant="primary"
                size="large"
                onClick={() => navigate("/app/categories")}
              >
                Browse Categories
              </Button>
            )}
            <Button variant="plain" url="https://arcade.ai" external>
              Learn more about Arcade
            </Button>
          </BlockStack>

          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              How it works
            </Text>
            <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
              {STEPS.map((step) => (
                <Card key={step.number}>
                  <BlockStack gap="200">
                    <div className="mx-auto flex size-8 items-center justify-center rounded-full bg-[var(--p-color-bg-fill-brand)] text-[var(--p-color-text-on-fill)] text-sm font-semibold">
                      {step.number}
                    </div>
                    <Text as="h3" variant="headingSm" alignment="center">
                      {step.title}
                    </Text>
                    <Text
                      as="p"
                      variant="bodySm"
                      tone="subdued"
                      alignment="center"
                    >
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
