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
    retailPrice: string;
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

    const imageResponse = await fetch(sourceUrl);
    if (!imageResponse.ok) {
      console.warn(
        `[shopifyPublish] Failed to fetch image ${sourceUrl}: ${imageResponse.status}`,
      );
      continue;
    }
    const imageBlob = await imageResponse.blob();

    const formData = new FormData();
    for (const param of target.parameters) {
      formData.append(param.name, param.value);
    }
    formData.append("file", imageBlob, `arcade-design-${i}.png`);

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

export async function publishToShopify(
  graphql: AdminGraphql,
  params: PublishProductParams,
): Promise<PublishResult> {
  const images = await uploadImagesToShopify(graphql, params.imageUrls);

  const media = images.map((img) => ({
    mediaContentType: "IMAGE" as const,
    originalSource: img.resourceUrl,
  }));

  const uniqueSizes = [...new Set(params.variants.map((v) => v.size))];
  const uniqueFabrics = [...new Set(params.variants.map((v) => v.fabric))];

  const productInput: Record<string, unknown> = {
    title: params.title,
    descriptionHtml: params.descriptionHtml || "",
    productType: params.productTypeName,
    vendor: params.vendor ?? "Arcade",
    status: "ACTIVE",
  };

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
      console.error(
        `[shopifyPublish] productVariantsBulkCreate had errors: ${variantErrors.map((e: { message: string }) => e.message).join(", ")}`,
      );
    }
  }

  return { shopifyProductGid: productGid };
}
