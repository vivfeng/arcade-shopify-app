// Shopify Admin GraphQL mutations for publishing an ArcadeProduct to a
// merchant's store. All mutations use the `admin.graphql()` client from
// `authenticate.admin(request)` — it handles auth, API versioning, and
// rate limiting automatically.
//
// GraphQL only — no REST — as required for App Store approval.

// ─── Types ───

/** Minimal GraphQL client interface from @shopify/shopify-app-react-router */
interface AdminGraphql {
  (query: string, options?: { variables?: Record<string, unknown> }): Promise<Response>;
}

export interface ShopifyImage {
  resourceUrl: string;
  alt?: string;
}

export interface PublishProductParams {
  title: string;
  descriptionHtml: string;
  productTypeName: string;
  vendor?: string;
  imageUrls: string[];
  variants: Array<{
    size: string;
    fabric: string;
    retailPrice: string; // Decimal as string e.g. "24.99"
  }>;
}

export interface PublishResult {
  shopifyProductGid: string;
}

// ─── Staged Uploads ───

const STAGED_UPLOADS_CREATE = `#graphql
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        resourceUrl
        url
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Upload images from public URLs (GCS) to Shopify's CDN via staged uploads.
 *
 * Flow: stagedUploadsCreate → get presigned URLs → POST each image → return resourceUrls
 */
export async function uploadImagesToShopify(
  graphql: AdminGraphql,
  imageUrls: string[],
): Promise<ShopifyImage[]> {
  if (imageUrls.length === 0) return [];

  const input = imageUrls.map((url, i) => ({
    resource: "IMAGE" as const,
    filename: `arcade-design-${i}.png`,
    mimeType: "image/png",
    httpMethod: "POST" as const,
  }));

  const response = await graphql(STAGED_UPLOADS_CREATE, {
    variables: { input },
  });
  const { data } = await response.json();

  const targets = data?.stagedUploadsCreate?.stagedTargets;
  const userErrors = data?.stagedUploadsCreate?.userErrors;

  if (userErrors?.length) {
    throw new Error(
      `stagedUploadsCreate failed: ${userErrors.map((e: { message: string }) => e.message).join(", ")}`,
    );
  }

  if (!targets || targets.length === 0) {
    throw new Error("stagedUploadsCreate returned no targets");
  }

  const results: ShopifyImage[] = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const sourceUrl = imageUrls[i];

    // Fetch the image from GCS
    const imageResponse = await fetch(sourceUrl);
    if (!imageResponse.ok) {
      console.warn(
        `[shopifyPublish] Failed to fetch image ${sourceUrl}: ${imageResponse.status}`,
      );
      continue;
    }
    const imageBlob = await imageResponse.blob();

    // Build multipart form with the parameters Shopify expects
    const formData = new FormData();
    for (const param of target.parameters) {
      formData.append(param.name, param.value);
    }
    formData.append("file", imageBlob, `arcade-design-${i}.png`);

    // Upload to Shopify's staged URL
    const uploadResponse = await fetch(target.url, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      console.warn(
        `[shopifyPublish] Staged upload failed for image ${i}: ${uploadResponse.status}`,
      );
      continue;
    }

    results.push({ resourceUrl: target.resourceUrl });
  }

  return results;
}

// ─── Product Create ───

const PRODUCT_CREATE = `#graphql
  mutation productCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
    productCreate(product: $product, media: $media) {
      product {
        id
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── Variant Create ───

const VARIANTS_BULK_CREATE = `#graphql
  mutation productVariantsBulkCreate(
    $productId: ID!
    $variants: [ProductVariantsBulkInput!]!
  ) {
    productVariantsBulkCreate(productId: $productId, variants: $variants) {
      productVariants {
        id
        title
        price
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Create a product in the merchant's Shopify store with images and variants.
 *
 * Steps:
 *   1. Upload images via stagedUploadsCreate
 *   2. Create the product with media attached
 *   3. Create all size × fabric variants with individual pricing
 *
 * Returns the Shopify product GID (e.g. "gid://shopify/Product/12345").
 */
export async function publishToShopify(
  graphql: AdminGraphql,
  params: PublishProductParams,
): Promise<PublishResult> {
  // 1. Upload images
  const images = await uploadImagesToShopify(graphql, params.imageUrls);

  // 2. Create product
  const media = images.map((img) => ({
    mediaContentType: "IMAGE" as const,
    originalSource: img.resourceUrl,
  }));

  // Build product options — Size and Fabric — so variants map correctly
  const uniqueSizes = [...new Set(params.variants.map((v) => v.size))];
  const uniqueFabrics = [...new Set(params.variants.map((v) => v.fabric))];

  const productInput: Record<string, unknown> = {
    title: params.title,
    descriptionHtml: params.descriptionHtml || "",
    productType: params.productTypeName,
    vendor: params.vendor ?? "Arcade",
    status: "ACTIVE",
  };

  // Only add options if we have variants
  if (params.variants.length > 0) {
    productInput.productOptions = [
      { name: "Size", values: uniqueSizes.map((s) => ({ name: s })) },
      { name: "Fabric", values: uniqueFabrics.map((f) => ({ name: f })) },
    ];
  }

  const createResponse = await graphql(PRODUCT_CREATE, {
    variables: {
      product: productInput,
      media: media.length > 0 ? media : undefined,
    },
  });
  const createData = await createResponse.json();

  const createErrors = createData.data?.productCreate?.userErrors;
  if (createErrors?.length) {
    throw new Error(
      `productCreate failed: ${createErrors.map((e: { message: string }) => e.message).join(", ")}`,
    );
  }

  const productGid = createData.data?.productCreate?.product?.id;
  if (!productGid) {
    throw new Error("productCreate returned no product ID");
  }

  // 3. Create variants (skip the default variant Shopify auto-creates)
  if (params.variants.length > 0) {
    const variantInputs = params.variants.map((v) => ({
      optionValues: [
        { optionName: "Size", name: v.size },
        { optionName: "Fabric", name: v.fabric },
      ],
      price: v.retailPrice,
    }));

    const variantResponse = await graphql(VARIANTS_BULK_CREATE, {
      variables: {
        productId: productGid,
        variants: variantInputs,
      },
    });
    const variantData = await variantResponse.json();

    const variantErrors =
      variantData.data?.productVariantsBulkCreate?.userErrors;
    if (variantErrors?.length) {
      // Non-fatal: product is created, variants failed — log but don't throw
      console.error(
        `[shopifyPublish] productVariantsBulkCreate had errors: ${variantErrors.map((e: { message: string }) => e.message).join(", ")}`,
      );
    }
  }

  return { shopifyProductGid: productGid };
}
