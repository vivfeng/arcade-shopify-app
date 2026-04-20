import { data, type LoaderFunctionArgs, type ActionFunctionArgs, useLoaderData, useNavigate, useFetcher } from "react-router";
import { AppPage } from "../../../components/layout/AppPage";
import { authenticate } from "../../../shopify.server";
import db from "../../../db.server";
import { createClientAuthToken, requestDesignGeneration, resolveArcadeAccountId } from "../../../services/arcade/arcadeApi.server";
import { useState, useCallback, useEffect } from "react";
import { useDesignGeneration } from "../../../hooks/useDesignGeneration";
import { uploadInspirationImage } from "../../../services/firebase/storage";
import { LoadingCard } from "../../../components/ui/LoadingCard";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { PageShell } from "../../../components/layout/PageShell";
import { Sparkles, Palette, Image as ImageIcon, LayoutGrid, ArrowRight, Pencil, X, Loader2 } from "lucide-react";
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
const COLOR_OPTIONS = [
  "Warm Neutrals",
  "Cool Blues",
  "Earth Tones",
  "Pastels",
  "Bold & Vibrant",
  "Monochrome",
  "Sunset",
  "Forest Green",
];

function parseInspirationImageUrls(raw: FormDataEntryValue | null): string[] | undefined {
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
  const { admin, session } = await authenticate.admin(request);

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
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!productType) {
    throw new Response("Product type not found", { status: 404 });
  }

  const arcadeAccountId = await resolveArcadeAccountId(session.shop, admin.graphql);
  const firebaseCustomToken = await createClientAuthToken(arcadeAccountId);

  return data({ productType, arcadeAccountId, firebaseCustomToken });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = (formData.get("intent") as string) || "generate";

  const shop = await db.shop.findUnique({
    where: { domain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    return data({ error: "Shop not found for authenticated session" }, { status: 400 });
  }

  if (intent === "edit") {
    return data(
      { error: "Edit Design is not yet available." },
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
    parentProductId = (formData.get("parentProductId") as string | null) ?? null;
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

  const arcadeAccountId = await resolveArcadeAccountId(session.shop, admin.graphql);

  const inspirationImageUrls = parseInspirationImageUrls(
    formData.get("inspirationImageUrls"),
  );

  try {
    const generation = await requestDesignGeneration(
      { prompt, inspirationImageUrls },
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
  const { productType, arcadeAccountId, firebaseCustomToken } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher<{
    productId?: string;
    arcadeDocumentId?: string;
    generationId?: string;
    error?: string;
  }>();

  const [prompt, setPrompt] = useState("");
  const [selectedColors, setSelectedColors] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [editInstruction, setEditInstruction] = useState("");

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
  const generationFailed =
    serverError != null ||
    design.status === "failed" ||
    (savedProductId != null && !hasResults && !isLoading && firestoreDocId != null);
  const errorMessage = serverError
    ? serverError
    : design.error
      ? `Design generation failed: ${design.error}`
      : "Design generation didn't return images this time. Your prompt has been saved — try hitting Regenerate above.";
  const mainImage = generatedImages[selectedImageIdx] ?? generatedImages[0];

  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;

    let fullPrompt = prompt.trim();
    if (selectedColors) fullPrompt += `\nColors: ${selectedColors}`;
    if (selectedArtist) fullPrompt += `\nStyle: ${selectedArtist}`;

    setSelectedImageIdx(0);
    setEditInstruction("");
    setFirestoreDocId(null);
    design.reset();

    fetcher.submit(
      {
        intent: "generate",
        prompt: fullPrompt,
        productTypeId: productType.id,
        colors: selectedColors || "",
        artist: selectedArtist || "",
        inspirationImageUrls: JSON.stringify(uploadedImageUrls),
      },
      { method: "post" },
    );
  }, [canGenerate, prompt, selectedColors, selectedArtist, productType.id, fetcher, uploadedImageUrls]);

  const handleRegenerate = useCallback(() => {
    if (!savedProductId || isLoading) return;

    let fullPrompt = prompt.trim();
    if (selectedColors) fullPrompt += `\nColors: ${selectedColors}`;
    if (selectedArtist) fullPrompt += `\nStyle: ${selectedArtist}`;

    setSelectedImageIdx(0);
    setEditInstruction("");
    setFirestoreDocId(null);
    design.reset();

    fetcher.submit(
      {
        intent: "regenerate",
        parentProductId: savedProductId,
        prompt: fullPrompt,
        colors: selectedColors || "",
        artist: selectedArtist || "",
        inspirationImageUrls: JSON.stringify(uploadedImageUrls),
      },
      { method: "post" },
    );
  }, [savedProductId, isLoading, prompt, selectedColors, selectedArtist, fetcher, uploadedImageUrls]);

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

  const canEdit =
    editInstruction.trim().length > 0 && savedProductId != null && !isLoading;

  const handleEdit = useCallback(() => {
    if (!canEdit || !savedProductId) return;

    setSelectedImageIdx(0);

    fetcher.submit(
      {
        intent: "edit",
        parentProductId: savedProductId,
        editInstruction: editInstruction.trim(),
      },
      { method: "post" },
    );

    setEditInstruction("");
  }, [canEdit, savedProductId, editInstruction, fetcher]);

  return (
    <AppPage>
      <PageShell
        heading="Prompt Design"
        subtitle="Describe your design and let AI create it for you"
        backLabel="Back to Categories"
        onBack={() => navigate(`/app/categories/${productType.category.slug}`)}
      >
        {/* Prompt card */}
        <div className="flex flex-col gap-4 rounded-xl border border-card-border bg-card p-5 shadow-card">
          <textarea
            className="w-full min-h-40 border-none outline-none resize-y text-[15px] leading-relaxed text-primary bg-transparent p-0"
            placeholder={`Describe your ${productType.name.toLowerCase()} design...\n\nFor example: "A floral pattern with soft peonies and eucalyptus leaves, hand-painted feel, light cream background"`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <hr className="w-full h-px bg-surface-muted border-none m-0" />

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 h-8 px-3 rounded-2xl border bg-gold-pale border-gold-border text-gold-dark text-[13px] font-medium">
              <LayoutGrid className="size-3.5" />
              {productType.category.name}
            </div>

            <ChipDropdown
              icon={<Palette className="size-3.5" />}
              label="Colors"
              value={selectedColors}
              options={COLOR_OPTIONS}
              onSelect={setSelectedColors}
            />

            <ChipDropdown
              icon={<Sparkles className="size-3.5" />}
              label="Artist"
              value={selectedArtist}
              options={ARTIST_STYLES}
              onSelect={setSelectedArtist}
            />

            <label
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-2xl border text-[13px] font-medium transition-colors ${
                uploadedImageUrls.length > 0
                  ? "bg-gold-pale border-gold-border text-gold-dark"
                  : "bg-card border-card-border text-primary"
              } ${canUploadMore ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImageIcon className="size-3.5" />
              )}
              {isUploading
                ? "Uploading…"
                : uploadedImageUrls.length > 0
                  ? `Image (${uploadedImageUrls.length}/${MAX_INSPIRATION_IMAGES})`
                  : "Image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!canUploadMore}
                onChange={handleInspirationUpload}
              />
            </label>
          </div>

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

          {uploadError && <ErrorBanner message={uploadError} />}

          <div className="flex justify-end items-center">
            <button
              type="button"
              onClick={hasResults ? handleRegenerate : handleGenerate}
              disabled={!canGenerate}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-lg border-none bg-primary text-card text-sm font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="size-4" />
              {isLoading
                ? "Generating..."
                : hasResults
                  ? "Regenerate"
                  : "Generate"}
            </button>
          </div>
        </div>

        {isLoading && (
          <LoadingCard
            title={`Generating your ${productType.name.toLowerCase()} design…`}
            subtitle="This usually takes 10–15 seconds"
          />
        )}

        {generationFailed && <ErrorBanner message={errorMessage} />}

        {hasResults && !isLoading && (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-xl border border-card-border bg-card shadow-card aspect-square flex items-center justify-center">
              <img
                src={mainImage}
                alt="Generated design"
                className="size-full object-cover"
              />
            </div>

            {generatedImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {generatedImages.map((url, idx) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`size-[72px] shrink-0 rounded-lg p-0 cursor-pointer overflow-hidden bg-surface-muted border-2 ${
                      idx === selectedImageIdx
                        ? "border-gold"
                        : "border-transparent"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Variation ${idx + 1}`}
                      className="size-full object-cover block"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-card-border bg-card p-3 shadow-card">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder='Describe a change… e.g. "make it more red" or "change floral to geometric"'
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canEdit) handleEdit();
                  }}
                  className="flex-1 h-10 px-3 rounded-lg border border-card-border bg-transparent text-sm text-primary outline-none"
                />
                <button
                  type="button"
                  onClick={handleEdit}
                  disabled={!canEdit}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border-none bg-primary text-card text-sm font-semibold cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Pencil className="size-3.5" />
                  Edit Design
                </button>
              </div>
            </div>

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
      </PageShell>
    </AppPage>
  );
}
