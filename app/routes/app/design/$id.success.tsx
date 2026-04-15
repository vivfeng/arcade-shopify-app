import { data, redirect, type LoaderFunctionArgs, Link, useLoaderData } from "react-router";
import { Page } from "@shopify/polaris";
import { authenticate } from "../../../shopify.server";
import db from "../../../db.server";
import { gidToNumericId } from "../../../lib/format";
import { CheckCircle, Sparkles, ArrowRight } from "lucide-react";

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

  if (product.status !== "ACTIVE") {
    throw redirect(`/app/design/${product.id}/pricing`);
  }

  return data({
    product: {
      id: product.id,
      displayName: product.title ?? product.productType.name,
      shopifyProductGid: product.shopifyProductGid,
    },
  });
};

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
    <div className="flex items-center justify-center min-h-[70vh] bg-page p-8">
      <div
        className="flex w-[480px] flex-col items-center justify-center gap-4.5 rounded-xl bg-card p-12 shadow-card"
        data-testid="success-card"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-success-bg text-success-fg">
          <CheckCircle className="size-7" />
        </div>

        <h1 className="m-0 text-center font-display text-[28px] font-bold leading-[30.8px] tracking-tight text-primary">
          Product Published!
        </h1>

        <p className="m-0 text-center text-sm leading-relaxed text-subdued">
          Your {displayName} is now live in your Shopify store.
        </p>

        {numericId ? (
          <a
            href={`shopify://admin/products/${numericId}`}
            target="_top"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-card no-underline"
            data-testid="primary-cta-shopify"
          >
            View in Shopify Admin
            <ArrowRight className="size-4" />
          </a>
        ) : (
          <Link
            to="/app/categories"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-card no-underline"
            data-testid="primary-cta-fallback"
          >
            Browse Categories
            <ArrowRight className="size-4" />
          </Link>
        )}

        <Link
          to="/app/categories"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-card-border bg-card px-5 text-sm font-medium text-secondary no-underline"
          data-testid="secondary-cta"
        >
          <Sparkles className="size-4" />
          Create Another Product
        </Link>
      </div>
    </div>
  );
}

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
