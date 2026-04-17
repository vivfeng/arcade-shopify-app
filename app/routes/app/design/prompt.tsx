import { data, type LoaderFunctionArgs, type ActionFunctionArgs, useLoaderData, useNavigate, useFetcher } from "react-router";
import { Page } from "@shopify/polaris";
import { authenticate } from "../../../shopify.server";
import db from "../../../db.server";
import { requestDesignGeneration, resolveArcadeAccountId } from "../../../services/arcade/arcadeApi.server";
import { useState, useCallback, useEffect } from "react";
import { useDesignGeneration } from "../../../hooks/useDesignGeneration";
import { LoadingCard } from "../../../components/ui/LoadingCard";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { PageShell } from "../../../components/layout/PageShell";
import { Sparkles, Palette, Image, LayoutGrid, ArrowRight, Pencil } from "lucide-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

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

  return data({ productType });
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

  const arcadeAccountId = await resolveArcadeAccountId(session.shop, admin.graphql);

  const prompt = formData.get("prompt") as string;
  const productTypeId = formData.get("productTypeId") as string;

  if (!prompt || !productTypeId) {
    return data(
      { error: "Prompt and product type are required" },
      { status: 400 },
    );
  }

  const colorsValue = (formData.get("colors") as string) || undefined;
  const artistValue = (formData.get("artist") as string) || undefined;

  const productType = await db.productType.findUnique({
    where: { id: productTypeId },
    select: { slug: true },
  });

  if (!productType) {
    return data({ error: "Product type not found" }, { status: 400 });
  }

  let arcadeDocumentId: string | null = null;
  let generationId: string | null = null;

  try {
    const generation = await requestDesignGeneration({ prompt }, arcadeAccountId);
    arcadeDocumentId = generation.firestoreDocumentId;
    generationId = generation.dreamId ?? null;
  } catch (err) {
    console.error("[AII-826] Arcade design generation failed:", err);
  }

  const product = await db.arcadeProduct.create({
    data: {
      designPrompt: prompt,
      arcadeDocumentId,
      generationId,
      imageUrls: [],
      shopId: shop.id,
      productTypeId,
      status: "DRAFT",
    },
  });

  return data({
    productId: product.id,
    arcadeDocumentId,
    generationId,
  });
};

function ChipDropdown({
  icon,
  label,
  value,
  options,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  options: string[];
  onSelect: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-2xl border cursor-pointer text-[13px] font-medium transition-colors ${
          value
            ? "bg-gold-pale border-gold-border text-gold-dark"
            : "bg-card border-card-border text-primary"
        }`}
        onClick={() => setOpen(!open)}
      >
        {icon}
        {value || label}
      </button>
      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 min-w-[180px] rounded-lg border border-card-border bg-card py-1.5 shadow-dropdown z-10">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`block w-full px-3.5 py-2 border-none text-left cursor-pointer text-[13px] text-primary hover:bg-page ${
                opt === value ? "font-semibold bg-page" : "bg-transparent font-normal"
              }`}
              onClick={() => {
                onSelect(opt);
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

export default function PromptDesign() {
  const { productType } = useLoaderData<typeof loader>();
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
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
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
  const canGenerate = prompt.trim().length > 0 && !isLoading;

  const generatedImages = design.imageUrls;
  const savedProductId = fetcher.data?.productId ?? null;
  const hasResults = generatedImages.length > 0;
  const generationFailed =
    design.status === "failed" ||
    (savedProductId != null && !hasResults && !isLoading && firestoreDocId != null);
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
      },
      { method: "post" },
    );
  }, [canGenerate, prompt, selectedColors, selectedArtist, productType.id, fetcher]);

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
      },
      { method: "post" },
    );
  }, [savedProductId, isSubmitting, prompt, selectedColors, selectedArtist, fetcher]);

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
    <Page>
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
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-2xl border cursor-pointer text-[13px] font-medium transition-colors ${
                referenceImage
                  ? "bg-gold-pale border-gold-border text-gold-dark"
                  : "bg-card border-card-border text-primary"
              }`}
            >
              <Image className="size-3.5" />
              {referenceImage ? referenceImage.name : "Image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setReferenceImage(file);
                }}
              />
            </label>
          </div>

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

        {generationFailed && (
          <ErrorBanner
            message={
              design.error
                ? `Design generation failed: ${design.error}`
                : "Design generation didn't return images this time. Your prompt has been saved — try hitting Regenerate above."
            }
          />
        )}

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
    </Page>
  );
}
