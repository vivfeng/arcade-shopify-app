import {
  data,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  useLoaderData,
  useNavigate,
  useFetcher,
} from "react-router";
import { AppPage } from "../../../components/layout/AppPage";
import { authenticate } from "../../../shopify.server";
import db from "../../../db.server";
import {
  createClientAuthToken,
  getArcadeAccountIdForShop,
  requestDesignGeneration,
  requireArcadeAccountIdForApi,
} from "../../../services/arcade/arcadeApi.server";
import { isAllowedShopifyManufacturerId } from "../../../lib/shopifyChannelRules";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDesignGeneration } from "../../../hooks/useDesignGeneration";
import { uploadInspirationImage } from "../../../services/firebase/storage";
import { LoadingCard } from "../../../components/ui/LoadingCard";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { PageShell } from "../../../components/layout/PageShell";
import { CreationPromptBar } from "../../../components/create/CreationPromptBar";
import { InspirationColorsTrigger } from "../../../components/create/InspirationColorsTrigger";
import type { CreateInspirationColor } from "../../../lib/inspirationColors";
import {
  Image as ImageIcon,
  LayoutGrid,
  ArrowRight,
  Pencil,
  Sparkles,
  Loader2,
  X,
} from "lucide-react";
import { transformShopifyPrintedTextileDesignPrompt } from "../../../lib/shopifyDesignPromptTransform";
import { ChipDropdown } from "./components";

const MAX_INSPIRATION_IMAGES = 3;
const ARTIST_STYLES = [
  "Watercolor",
  "Oil Painting",
  "Minimalist",
  "Abstract",
  "Botanical",
  "Geometric",
  "Impressionist",
  "Art Deco",
];

const INSPIRATION_HEX_ITEM = /^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/;

type DesignResultCardProps = {
  imageUrl: string;
  imageIndex: number;
  alt: string;
  selected: boolean;
  onSelect: () => void;
  onRefineInPrompt: () => void;
};

function DesignResultCard({
  imageUrl,
  imageIndex,
  alt,
  selected,
  onSelect,
  onRefineInPrompt,
}: DesignResultCardProps) {
  return (
    <div
      className={`group relative aspect-square overflow-hidden rounded-xl border-2 bg-surface-muted shadow-card transition-[border-color,transform] duration-200 hover:scale-[1.02] ${
        selected
          ? "border-gold ring-1 ring-gold/25"
          : "border-card-border hover:border-card-border-hover"
      }`}
    >
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="pointer-events-none absolute inset-0 size-full object-cover"
      />
      <button
        type="button"
        onClick={onSelect}
        className="absolute inset-0 z-[1] cursor-pointer rounded-[inherit] border-none bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
        aria-pressed={selected}
        aria-label={`Select generated design ${imageIndex + 1}`}
      />
      <div className="absolute right-3 top-3 z-20 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRefineInPrompt();
          }}
          className="inline-flex size-9 items-center justify-center rounded-full border border-card-border bg-primary text-card shadow-[0_1px_4px_rgba(15,15,15,0.12)] transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          aria-label="Refine in prompt"
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function parseInspirationHexCodesField(
  raw: FormDataEntryValue | null,
): string[] {
  if (typeof raw !== "string" || raw.trim() === "") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const out: string[] = [];
    for (const item of parsed) {
      if (typeof item === "string" && INSPIRATION_HEX_ITEM.test(item)) {
        out.push(item);
      }
      if (out.length >= 3) {
        break;
      }
    }
    return out;
  } catch {
    return [];
  }
}

function parseInspirationImageUrls(
  raw: FormDataEntryValue | null,
): string[] | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const urls = parsed.filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    );
    return urls.length > 0 ? urls : undefined;
  } catch {
    return undefined;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const typeSlug = url.searchParams.get("type");

  if (!typeSlug) {
    throw new Response("Missing product type", { status: 400 });
  }

  const productType = await db.productType.findUnique({
    where: { slug: typeSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      specs: true,
      basePrice: true,
      manufacturerId: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!productType) {
    throw new Response("Product type not found", { status: 404 });
  }

  if (!isAllowedShopifyManufacturerId(productType.manufacturerId)) {
    throw new Response("This product type is not available for Shopify.", {
      status: 403,
    });
  }

  const linkedAccountId = await getArcadeAccountIdForShop(session.shop);
  if (!linkedAccountId) {
    throw redirect("/app/connect-arcade");
  }

  const firebaseCustomToken = await createClientAuthToken(linkedAccountId);

  return data({
    productType,
    arcadeAccountId: linkedAccountId,
    firebaseCustomToken,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = (formData.get("intent") as string) || "generate";

  const shop = await db.shop.findUnique({
    where: { domain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    return data(
      { error: "Shop not found for authenticated session" },
      { status: 400 },
    );
  }

  if (intent !== "generate" && intent !== "regenerate") {
    return data({ error: `Unknown intent: ${intent}` }, { status: 400 });
  }

  const prompt = (formData.get("prompt") as string | null)?.trim() ?? "";
  if (!prompt) {
    return data({ error: "Prompt is required" }, { status: 400 });
  }

  let productTypeId: string;
  let parentProductId: string | null = null;

  if (intent === "regenerate") {
    parentProductId =
      (formData.get("parentProductId") as string | null) ?? null;
    if (!parentProductId) {
      return data(
        { error: "parentProductId is required to regenerate" },
        { status: 400 },
      );
    }

    const parent = await db.arcadeProduct.findFirst({
      where: { id: parentProductId, shopId: shop.id },
      select: { productTypeId: true },
    });

    if (!parent) {
      return data({ error: "Parent design not found" }, { status: 404 });
    }

    productTypeId = parent.productTypeId;
  } else {
    productTypeId = (formData.get("productTypeId") as string | null) ?? "";
    if (!productTypeId) {
      return data({ error: "productTypeId is required" }, { status: 400 });
    }
  }

  let arcadeAccountId: string;
  try {
    arcadeAccountId = await requireArcadeAccountIdForApi(session.shop);
  } catch {
    return data(
      {
        error:
          "Connect your Arcade account before generating designs. Open Connect Arcade from the app menu.",
      },
      { status: 401 },
    );
  }

  const inspirationImageUrls = parseInspirationImageUrls(
    formData.get("inspirationImageUrls"),
  );
  const inspirationColorHexcodes = parseInspirationHexCodesField(
    formData.get("inspirationColorHexes"),
  );

  const promptForGeneration =
    transformShopifyPrintedTextileDesignPrompt(prompt);

  try {
    const generation = await requestDesignGeneration(
      {
        prompt: promptForGeneration,
        ...(inspirationImageUrls ? { inspirationImageUrls } : {}),
        ...(inspirationColorHexcodes.length > 0
          ? { inspirationColorHexcodes }
          : {}),
      },
      arcadeAccountId,
    );

    const product = await db.arcadeProduct.create({
      data: {
        designPrompt: prompt,
        arcadeDocumentId: generation.firestoreDocumentId,
        generationId: generation.dreamId ?? null,
        imageUrls: [],
        shopId: shop.id,
        productTypeId,
        parentProductId,
        status: "DRAFT",
      },
    });

    return data({
      productId: product.id,
      arcadeDocumentId: generation.firestoreDocumentId,
      generationId: generation.dreamId ?? null,
    });
  } catch (err) {
    console.error("[AII-826] Arcade design generation failed:", err);
    return data(
      { error: "Design generation failed. Please try again." },
      { status: 502 },
    );
  }
};

export default function PromptDesign() {
  const { productType, arcadeAccountId, firebaseCustomToken } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher<{
    productId?: string;
    arcadeDocumentId?: string;
    generationId?: string;
    error?: string;
  }>();
  const [prompt, setPrompt] = useState("");
  const [inspirationColors, setInspirationColors] = useState<
    CreateInspirationColor[]
  >([]);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [firestoreDocId, setFirestoreDocId] = useState<string | null>(null);
  const design = useDesignGeneration(firestoreDocId);

  useEffect(() => {
    if (fetcher.data?.arcadeDocumentId) {
      setFirestoreDocId(fetcher.data.arcadeDocumentId);
    }
  }, [fetcher.data?.arcadeDocumentId]);

  const isSubmitting = fetcher.state !== "idle";
  const isMonitoring = design.status === "monitoring";
  const isLoading = isSubmitting || isMonitoring;
  const canGenerate = prompt.trim().length > 0 && !isLoading && !isUploading;
  const canUploadMore =
    uploadedImageUrls.length < MAX_INSPIRATION_IMAGES && !isUploading;

  const generatedImages = design.imageUrls;
  const savedProductId = fetcher.data?.productId ?? null;
  const serverError = fetcher.data?.error ?? null;
  const hasResults = generatedImages.length > 0;
  const generationComplete =
    design.status === "complete" && generatedImages.length > 0;
  const generationFailed =
    serverError != null ||
    design.status === "failed" ||
    (savedProductId != null && !hasResults && !isLoading && firestoreDocId != null);
  const errorMessage = serverError
    ? serverError
    : design.error
      ? `Design generation failed: ${design.error}`
      : "Design generation didn't return images this time. Your prompt has been saved — try Regenerate in the prompt bar below.";

  const typewriterHints = useMemo(() => {
    if (hasResults) {
      return [
        "Describe tweaks in the prompt bar—e.g. softer blues, larger florals…",
        "Add detail like scale, contrast, or motif style, then tap Regenerate…",
        "Refine the mood: minimal, bold, vintage—then regenerate from below…",
      ];
    }
    return [
      `Create a ${productType.name.toLowerCase()} with soft botanical motifs…`,
      `Design ${productType.name.toLowerCase()} in warm earth tones and a hand-painted feel…`,
      `Make a bold geometric ${productType.name.toLowerCase()} for a modern space…`,
    ];
  }, [hasResults, productType.name]);

  useEffect(() => {
    if (generatedImages.length === 0) return;
    setSelectedImageIdx((idx) =>
      idx >= generatedImages.length ? generatedImages.length - 1 : idx,
    );
  }, [generatedImages.length]);

  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;

    let fullPrompt = prompt.trim();
    if (selectedArtist) fullPrompt += `\nStyle: ${selectedArtist}`;

    setSelectedImageIdx(0);
    setFirestoreDocId(null);
    design.reset();

    fetcher.submit(
      {
        intent: "generate",
        prompt: fullPrompt,
        productTypeId: productType.id,
        artist: selectedArtist || "",
        inspirationImageUrls: JSON.stringify(uploadedImageUrls),
        inspirationColorHexes: JSON.stringify(
          inspirationColors.map((color) => color.hex),
        ),
      },
      { method: "post" },
    );
  }, [
    canGenerate,
    prompt,
    selectedArtist,
    uploadedImageUrls,
    inspirationColors,
    productType.id,
    fetcher,
    design,
  ]);

  const handleRegenerate = useCallback(() => {
    if (!savedProductId || isLoading) return;

    let fullPrompt = prompt.trim();
    if (selectedArtist) fullPrompt += `\nStyle: ${selectedArtist}`;

    setSelectedImageIdx(0);
    setFirestoreDocId(null);
    design.reset();

    fetcher.submit(
      {
        intent: "regenerate",
        parentProductId: savedProductId,
        prompt: fullPrompt,
        artist: selectedArtist || "",
        inspirationImageUrls: JSON.stringify(uploadedImageUrls),
        inspirationColorHexes: JSON.stringify(
          inspirationColors.map((color) => color.hex),
        ),
      },
      { method: "post" },
    );
  }, [
    savedProductId,
    isLoading,
    prompt,
    selectedArtist,
    uploadedImageUrls,
    inspirationColors,
    fetcher,
    design,
  ]);

  const handleInspirationUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      if (uploadedImageUrls.length >= MAX_INSPIRATION_IMAGES) return;

      setIsUploading(true);
      setUploadError(null);
      try {
        const url = await uploadInspirationImage(
          file,
          arcadeAccountId,
          firebaseCustomToken,
        );
        setUploadedImageUrls((prev) => [...prev, url]);
      } catch (err) {
        console.error("[AII-826] Inspiration image upload failed:", err);
        setUploadError(
          err instanceof Error
            ? `Image upload failed: ${err.message}`
            : "Image upload failed. Please try again.",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [arcadeAccountId, firebaseCustomToken, uploadedImageUrls.length],
  );

  const handleRemoveInspiration = useCallback((idx: number) => {
    setUploadedImageUrls((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handlePromptBarGenerate = useCallback(() => {
    if (hasResults) {
      handleRegenerate();
    } else {
      handleGenerate();
    }
  }, [hasResults, handleRegenerate, handleGenerate]);

  return (
    <AppPage>
      <PageShell
        heading="Prompt Design"
        subtitle="Describe your design and let AI create it for you"
        backLabel="Back to Categories"
        onBack={() => navigate(`/app/categories/${productType.category.slug}`)}
      >
        <div className="flex flex-col gap-4 pb-[min(40vh,24rem)] sm:pb-40">
          {isLoading && (
            <LoadingCard
              title={`Generating your ${productType.name.toLowerCase()} design…`}
              subtitle="This usually takes 10–15 seconds"
            />
          )}

          {generationFailed && <ErrorBanner message={errorMessage} />}

          {uploadError && <ErrorBanner message={uploadError} />}

          {uploadedImageUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploadedImageUrls.map((url, idx) => (
                <div
                  key={url}
                  className="relative size-16 rounded-lg overflow-hidden border border-card-border bg-surface-muted"
                >
                  <img
                    src={url}
                    alt={`Inspiration ${idx + 1}`}
                    className="size-full object-cover block"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveInspiration(idx)}
                    aria-label={`Remove inspiration image ${idx + 1}`}
                    className="absolute top-1 right-1 inline-flex items-center justify-center size-5 rounded-full border-none bg-black/60 text-white cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {generationComplete && !isLoading && (
            <div className="flex flex-col gap-4">
              {generatedImages.length > 1 ? (
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {generatedImages.map((url, idx) => (
                    <DesignResultCard
                      key={`${url}-${idx}`}
                      imageUrl={url}
                      imageIndex={idx}
                      alt={`Generated design ${idx + 1}`}
                      selected={idx === selectedImageIdx}
                      onSelect={() => setSelectedImageIdx(idx)}
                      onRefineInPrompt={() => {
                        setSelectedImageIdx(idx);
                        promptTextareaRef.current?.focus();
                        promptTextareaRef.current?.scrollIntoView({
                          block: "nearest",
                        });
                      }}
                    />
                  ))}
                </div>
              ) : (
                <DesignResultCard
                  imageUrl={generatedImages[0]}
                  imageIndex={0}
                  alt="Generated design"
                  selected
                  onSelect={() => setSelectedImageIdx(0)}
                  onRefineInPrompt={() => {
                    setSelectedImageIdx(0);
                    promptTextareaRef.current?.focus();
                    promptTextareaRef.current?.scrollIntoView({
                      block: "nearest",
                    });
                  }}
                />
              )}

              <p className="m-0 text-[13px] leading-snug text-subdued">
                Describe tweaks in the prompt bar below, then use Regenerate.
              </p>

              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/app/design/${savedProductId}/pricing`)
                  }
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-lg border-none bg-primary text-card text-sm font-semibold cursor-pointer"
                >
                  Continue to Pricing
                  <ArrowRight className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/app/categories/${productType.category.slug}`)
                  }
                  className="h-10 px-4 rounded-lg border border-card-border bg-card text-secondary text-sm font-medium cursor-pointer"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}
        </div>
      </PageShell>

      <CreationPromptBar
        prompt={prompt}
        onPromptChange={setPrompt}
        promptTextareaRef={promptTextareaRef}
        typewriterHints={typewriterHints}
        referencePreviewUrl={null}
        referenceLabel={null}
        onClearReference={() => setUploadedImageUrls([])}
        inspirationColors={inspirationColors}
        onInspirationColorsChange={setInspirationColors}
        filterSlot={
          <>
            <div className="inline-flex items-center gap-1.5 h-9 min-h-9 shrink-0 rounded-full border border-gold-border bg-gold-pale px-3.5 text-[13px] font-semibold text-gold-dark shadow-[0_1px_0_rgba(15,15,15,0.04)]">
              <LayoutGrid className="size-3.5 shrink-0" />
              <span className="max-w-[9rem] truncate sm:max-w-[12rem]">
                {productType.category.name}
              </span>
            </div>

            <InspirationColorsTrigger
              selectedColors={inspirationColors}
              onColorsChange={setInspirationColors}
              disabled={isLoading}
            />

            <ChipDropdown
              icon={<Sparkles className="size-3.5 shrink-0" />}
              label="Artist"
              value={selectedArtist}
              options={ARTIST_STYLES}
              onSelect={setSelectedArtist}
            />

            <label
              className={`inline-flex items-center gap-1.5 h-9 min-h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold shadow-[0_1px_0_rgba(15,15,15,0.04)] transition-[background-color,border-color,color,box-shadow] ${
                uploadedImageUrls.length > 0
                  ? "border-gold-border bg-gold-pale text-gold-dark"
                  : "border-card-border bg-card/90 text-primary hover:border-card-border-hover"
              } ${canUploadMore ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
            >
              {isUploading ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
              ) : (
                <ImageIcon className="size-3.5 shrink-0" />
              )}
              <span className="min-w-0 truncate">
                {isUploading
                  ? "Uploading…"
                  : uploadedImageUrls.length > 0
                    ? `Image (${uploadedImageUrls.length}/${MAX_INSPIRATION_IMAGES})`
                    : "Image"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!canUploadMore}
                onChange={handleInspirationUpload}
              />
            </label>
          </>
        }
        onGenerate={handlePromptBarGenerate}
        canGenerate={canGenerate}
        isGenerating={isLoading}
        hasResults={hasResults}
      />
    </AppPage>
  );
}
