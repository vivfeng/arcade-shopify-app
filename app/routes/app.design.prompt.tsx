import { data, type LoaderFunctionArgs, type ActionFunctionArgs, useLoaderData, useNavigate, useFetcher } from "react-router";
import { Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { colors, fonts, radius, shadows } from "../lib/tokens";
import {
  requestDesignGeneration,
  pollDesignDocument,
  requestDesignRegenerate,
  requestDesignEdit,
} from "../lib/arcadeApi";
import { useState, useCallback } from "react";

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
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = (formData.get("intent") as string) || "generate";

  // ── Auth: resolve the shop for all intents ──
  const shop = await db.shop.findUnique({
    where: { domain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    return data({ error: "Shop not found for authenticated session" }, { status: 400 });
  }

  // ── Shared helpers ──

  /** Normalize an Arcade design document into a flat image list. */
  function extractImages(designDoc: {
    imageUrls?: string[];
    patternUrl?: string;
    makerImageUrl?: string;
  }): string[] {
    const urls = [...(designDoc.imageUrls ?? [])];
    if (designDoc.patternUrl && !urls.includes(designDoc.patternUrl)) {
      urls.unshift(designDoc.patternUrl);
    }
    if (designDoc.makerImageUrl && !urls.includes(designDoc.makerImageUrl)) {
      urls.push(designDoc.makerImageUrl);
    }
    return urls;
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTENT: edit — iterative descriptive edit on an existing design
  // ═══════════════════════════════════════════════════════════════════
  if (intent === "edit") {
    const parentProductId = formData.get("parentProductId") as string;
    const editInstruction = formData.get("editInstruction") as string;

    if (!parentProductId || !editInstruction) {
      return data(
        { error: "Parent product ID and edit instruction are required" },
        { status: 400 },
      );
    }

    // Load the parent product to get the generationId + context
    const parentProduct = await db.arcadeProduct.findUnique({
      where: { id: parentProductId },
      select: {
        id: true,
        generationId: true,
        arcadeDocumentId: true,
        designPrompt: true,
        productTypeId: true,
        shopId: true,
      },
    });

    if (!parentProduct) {
      return data({ error: "Parent product not found" }, { status: 404 });
    }

    // The generationId is the key for chaining edits. Fall back to
    // arcadeDocumentId if the generation predates the generationId field.
    const sourceGenerationId =
      parentProduct.generationId ?? parentProduct.arcadeDocumentId;

    if (!sourceGenerationId) {
      return data(
        { error: "Parent product has no generation ID — cannot edit" },
        { status: 400 },
      );
    }

    let arcadeDocumentId: string | null = null;
    let generationId: string | null = null;
    let imageUrls: string[] = [];
    let suggestedTitle: string | null = null;
    let suggestedDescription: string | null = null;

    try {
      const editResponse = await requestDesignEdit({
        generationId: sourceGenerationId,
        editInstruction,
        shopId: shop.id,
      });
      arcadeDocumentId = editResponse.documentId;

      const designDoc = await pollDesignDocument(editResponse.documentId);
      generationId = designDoc.generationId ?? null;
      imageUrls = extractImages(designDoc);
      suggestedTitle = designDoc.suggestedTitle ?? null;
      suggestedDescription = designDoc.suggestedDescription ?? null;
    } catch (err) {
      console.error("[AII-826] Arcade design edit failed:", err);
    }

    // Create a new ArcadeProduct row linked to the parent
    const product = await db.arcadeProduct.create({
      data: {
        designPrompt: parentProduct.designPrompt,
        arcadeDocumentId,
        generationId,
        imageUrls: imageUrls.length > 0 ? imageUrls : [],
        shopId: parentProduct.shopId,
        productTypeId: parentProduct.productTypeId,
        parentProductId: parentProduct.id,
        status: "DRAFT",
        title: suggestedTitle,
        description: suggestedDescription,
      },
    });

    return data({
      productId: product.id,
      imageUrls,
      arcadeDocumentId,
      generationId,
      parentProductId: parentProduct.id,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTENT: regenerate — same prompt, fresh variations
  // ═══════════════════════════════════════════════════════════════════
  if (intent === "regenerate") {
    const parentProductId = formData.get("parentProductId") as string;

    if (!parentProductId) {
      return data(
        { error: "Parent product ID is required for regenerate" },
        { status: 400 },
      );
    }

    const parentProduct = await db.arcadeProduct.findUnique({
      where: { id: parentProductId },
      select: {
        id: true,
        generationId: true,
        arcadeDocumentId: true,
        designPrompt: true,
        productTypeId: true,
        shopId: true,
        productType: { select: { slug: true } },
      },
    });

    if (!parentProduct) {
      return data({ error: "Parent product not found" }, { status: 404 });
    }

    const sourceGenerationId =
      parentProduct.generationId ?? parentProduct.arcadeDocumentId;

    // Collect optional structured inputs (may have changed between generations)
    const colorsValue = (formData.get("colors") as string) || undefined;
    const artistValue = (formData.get("artist") as string) || undefined;
    const promptValue =
      (formData.get("prompt") as string) || parentProduct.designPrompt || "";

    let arcadeDocumentId: string | null = null;
    let generationId: string | null = null;
    let imageUrls: string[] = [];
    let suggestedTitle: string | null = null;
    let suggestedDescription: string | null = null;

    try {
      if (sourceGenerationId) {
        // Use regenerate endpoint if we have a generationId
        const regenResponse = await requestDesignRegenerate({
          generationId: sourceGenerationId,
          prompt: promptValue,
          generationType: parentProduct.productType.slug,
          colors: colorsValue,
          artistStyle: artistValue,
        });
        arcadeDocumentId = regenResponse.documentId;

        const designDoc = await pollDesignDocument(regenResponse.documentId);
        generationId = designDoc.generationId ?? null;
        imageUrls = extractImages(designDoc);
        suggestedTitle = designDoc.suggestedTitle ?? null;
        suggestedDescription = designDoc.suggestedDescription ?? null;
      } else {
        // Fallback: no generationId yet, do a fresh generate
        const genResponse = await requestDesignGeneration({
          prompt: promptValue,
          generationType: parentProduct.productType.slug,
          colors: colorsValue,
          artistStyle: artistValue,
        });
        arcadeDocumentId = genResponse.documentId;
        generationId = genResponse.generationId ?? null;

        const designDoc = await pollDesignDocument(genResponse.documentId);
        generationId = designDoc.generationId ?? generationId;
        imageUrls = extractImages(designDoc);
        suggestedTitle = designDoc.suggestedTitle ?? null;
        suggestedDescription = designDoc.suggestedDescription ?? null;
      }
    } catch (err) {
      console.error("[AII-826] Arcade design regeneration failed:", err);
    }

    // Create a new ArcadeProduct linked to the parent
    const product = await db.arcadeProduct.create({
      data: {
        designPrompt: promptValue,
        arcadeDocumentId,
        generationId,
        imageUrls: imageUrls.length > 0 ? imageUrls : [],
        shopId: parentProduct.shopId,
        productTypeId: parentProduct.productTypeId,
        parentProductId: parentProduct.id,
        status: "DRAFT",
        title: suggestedTitle,
        description: suggestedDescription,
      },
    });

    return data({
      productId: product.id,
      imageUrls,
      arcadeDocumentId,
      generationId,
      parentProductId: parentProduct.id,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTENT: generate (default) — initial design from prompt
  // ═══════════════════════════════════════════════════════════════════
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

  // AII-826: Call the Arcade staging backend design-from-prompt async API.
  //
  // Flow: POST to /design/generate → receive a documentId immediately →
  // poll the Firestore-backed document until it populates with images.
  //
  // ⚠️  Currently pointed at staging backend (https://api.staging.arcade.ai).
  // See: https://api.staging.arcade.ai/swagger/

  let arcadeDocumentId: string | null = null;
  let generationId: string | null = null;
  let imageUrls: string[] = [];
  let suggestedTitle: string | null = null;
  let suggestedDescription: string | null = null;

  try {
    const generation = await requestDesignGeneration({
      prompt,
      generationType: productType.slug,
      colors: colorsValue,
      artistStyle: artistValue,
    });
    arcadeDocumentId = generation.documentId;
    generationId = generation.generationId ?? null;

    const designDoc = await pollDesignDocument(generation.documentId);
    generationId = designDoc.generationId ?? generationId;
    imageUrls = extractImages(designDoc);
    suggestedTitle = designDoc.suggestedTitle ?? null;
    suggestedDescription = designDoc.suggestedDescription ?? null;
  } catch (err) {
    console.error("[AII-826] Arcade design generation failed:", err);
    // Still create the draft so the merchant's prompt isn't lost.
  }

  const product = await db.arcadeProduct.create({
    data: {
      designPrompt: prompt,
      arcadeDocumentId,
      generationId,
      imageUrls: imageUrls.length > 0 ? imageUrls : [],
      shopId: shop.id,
      productTypeId,
      status: "DRAFT",
      title: suggestedTitle,
      description: suggestedDescription,
    },
  });

  return data({
    productId: product.id,
    imageUrls,
    arcadeDocumentId,
    generationId,
  });
};

// ─── Styles ───

const s: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    maxWidth: 640,
  },
  backButton: {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color: colors.gold,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: fonts.sans,
  },
  heading: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: colors.textPrimary,
    letterSpacing: "-0.52px",
    lineHeight: "28.6px",
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    color: colors.textSubdued,
    fontFamily: fonts.sans,
  },
  card: {
    background: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radius.lg,
    boxShadow: shadows.card,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  textarea: {
    width: "100%",
    minHeight: 160,
    border: "none",
    outline: "none",
    resize: "vertical",
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: "22px",
    color: colors.textPrimary,
    background: "transparent",
    padding: 0,
  },
  chipsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 32,
    padding: "0 12px",
    borderRadius: radius.pill,
    border: `1px solid ${colors.cardBorder}`,
    background: colors.cardBg,
    cursor: "pointer",
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: 500,
    color: colors.textPrimary,
    transition: "border-color 150ms ease, background 150ms ease",
  },
  chipActive: {
    background: colors.goldPale,
    borderColor: colors.goldBorder,
    color: colors.goldDark,
  },
  chipIcon: {
    fontSize: 14,
    lineHeight: 1,
    flexShrink: 0,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  generateButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 40,
    padding: "0 20px",
    borderRadius: radius.md,
    border: "none",
    background: colors.textPrimary,
    color: colors.cardBg,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.sans,
    cursor: "pointer",
  },
  generateButtonDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  divider: {
    width: "100%",
    height: 1,
    background: colors.surfaceMuted,
    border: "none",
    margin: 0,
  },
  // Chip dropdown
  dropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    background: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radius.md,
    boxShadow: shadows.dropdown,
    padding: "6px 0",
    zIndex: 10,
    minWidth: 180,
  },
  dropdownItem: {
    display: "block",
    width: "100%",
    padding: "8px 14px",
    border: "none",
    background: "transparent",
    textAlign: "left" as const,
    cursor: "pointer",
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textPrimary,
  },
  // ── Loading state ──
  loadingCard: {
    background: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radius.lg,
    boxShadow: shadows.card,
    padding: 40,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 12,
  },
  spinner: {
    width: 32,
    height: 32,
    border: `3px solid ${colors.surfaceMuted}`,
    borderTopColor: colors.gold,
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
  },
  loadingSubtext: {
    margin: 0,
    fontSize: 13,
    color: colors.textSubdued,
    fontFamily: fonts.sans,
  },
  // ── Error state ──
  errorCard: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: radius.lg,
    padding: 16,
  },
  errorText: {
    margin: 0,
    fontSize: 14,
    lineHeight: "22px",
    color: "#991b1b",
    fontFamily: fonts.sans,
  },
  // ── Design results (inline PDP) ──
  resultsSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  mainImageContainer: {
    background: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radius.lg,
    boxShadow: shadows.card,
    overflow: "hidden",
    aspectRatio: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  mainImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  },
  thumbnailRow: {
    display: "flex",
    gap: 8,
    overflowX: "auto" as const,
  },
  thumbnail: {
    width: 72,
    height: 72,
    flexShrink: 0,
    borderRadius: radius.md,
    border: `2px solid transparent`,
    padding: 0,
    cursor: "pointer",
    overflow: "hidden",
    background: colors.surfaceMuted,
  },
  thumbnailSelected: {
    borderColor: colors.gold,
  },
  thumbnailImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  },
  resultsActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  secondaryButton: {
    height: 40,
    padding: "0 16px",
    background: colors.cardBg,
    color: colors.textSecondary,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radius.md,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: fonts.sans,
    cursor: "pointer",
  },
  // ── Edit Design affordance ──
  editCard: {
    background: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radius.lg,
    boxShadow: shadows.card,
    padding: 12,
  },
  editRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  editInput: {
    flex: 1,
    height: 40,
    padding: "0 12px",
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radius.md,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textPrimary,
    background: "transparent",
    outline: "none",
  },
  editButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 40,
    padding: "0 16px",
    borderRadius: radius.md,
    border: "none",
    background: colors.textPrimary,
    color: colors.cardBg,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.sans,
    cursor: "pointer",
    flexShrink: 0,
  },
};

// ─── Chip with dropdown ───

function ChipDropdown({
  icon,
  label,
  value,
  options,
  onSelect,
}: {
  icon: string;
  label: string;
  value: string | null;
  options: string[];
  onSelect: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        style={{
          ...s.chip,
          ...(value ? s.chipActive : {}),
        }}
        onClick={() => setOpen(!open)}
      >
        <span style={s.chipIcon}>{icon}</span>
        {value || label}
      </button>
      {open && (
        <div style={s.dropdown}>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              style={{
                ...s.dropdownItem,
                fontWeight: opt === value ? 600 : 400,
                background: opt === value ? colors.pageBg : "transparent",
              }}
              onClick={() => {
                onSelect(opt);
                setOpen(false);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.pageBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  opt === value ? colors.pageBg : "transparent";
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

// ─── Artist options ───

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

// ─── Main component ───

export default function PromptDesign() {
  const { productType } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher<{
    productId?: string;
    imageUrls?: string[];
    arcadeDocumentId?: string;
    generationId?: string;
    parentProductId?: string;
    error?: string;
  }>();

  const [prompt, setPrompt] = useState("");
  const [selectedColors, setSelectedColors] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [editInstruction, setEditInstruction] = useState("");

  const isSubmitting = fetcher.state !== "idle";
  const canGenerate = prompt.trim().length > 0 && !isSubmitting;

  // Results from the Arcade staging backend
  const generatedImages =
    fetcher.data && "imageUrls" in fetcher.data
      ? (fetcher.data.imageUrls ?? [])
      : [];
  const savedProductId =
    fetcher.data && "productId" in fetcher.data
      ? fetcher.data.productId
      : null;
  const hasResults = generatedImages.length > 0;
  const generationFailed =
    savedProductId != null && !hasResults && fetcher.state === "idle";
  const mainImage = generatedImages[selectedImageIdx] ?? generatedImages[0];

  // ── Generate (initial) ──
  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;

    let fullPrompt = prompt.trim();
    if (selectedColors) fullPrompt += `\nColors: ${selectedColors}`;
    if (selectedArtist) fullPrompt += `\nStyle: ${selectedArtist}`;

    setSelectedImageIdx(0);
    setEditInstruction("");

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

  // ── Regenerate (same prompt, fresh variations) ──
  const handleRegenerate = useCallback(() => {
    if (!savedProductId || isSubmitting) return;

    let fullPrompt = prompt.trim();
    if (selectedColors) fullPrompt += `\nColors: ${selectedColors}`;
    if (selectedArtist) fullPrompt += `\nStyle: ${selectedArtist}`;

    setSelectedImageIdx(0);
    setEditInstruction("");

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

  // ── Iterative edit ──
  const canEdit =
    editInstruction.trim().length > 0 && savedProductId != null && !isSubmitting;

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
      <div style={s.container}>
        {/* Back link */}
        <button
          type="button"
          onClick={() =>
            navigate(`/app/categories/${productType.category.slug}`)
          }
          style={s.backButton}
        >
          ← Back to Categories
        </button>

        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={s.heading}>Prompt Design</h1>
          <p style={s.subtitle}>
            Describe your design and let AI create it for you
          </p>
        </div>

        {/* Prompt card — always visible so the merchant can iterate */}
        <div style={s.card}>
          <textarea
            style={s.textarea}
            placeholder={`Describe your ${productType.name.toLowerCase()} design...\n\nFor example: "A floral pattern with soft peonies and eucalyptus leaves, hand-painted feel, light cream background"`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <hr style={s.divider} />

          {/* Structured input chips */}
          <div style={s.chipsRow}>
            <div
              style={{
                ...s.chip,
                ...s.chipActive,
                cursor: "default",
              }}
            >
              <span style={s.chipIcon}>◫</span>
              {productType.category.name}
            </div>

            <ChipDropdown
              icon="◕"
              label="Colors"
              value={selectedColors}
              options={COLOR_OPTIONS}
              onSelect={setSelectedColors}
            />

            <ChipDropdown
              icon="✦"
              label="Artist"
              value={selectedArtist}
              options={ARTIST_STYLES}
              onSelect={setSelectedArtist}
            />

            <label
              style={{
                ...s.chip,
                ...(referenceImage ? s.chipActive : {}),
              }}
            >
              <span style={s.chipIcon}>◩</span>
              {referenceImage ? referenceImage.name : "Image"}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setReferenceImage(file);
                }}
              />
            </label>
          </div>

          {/* Generate / Regenerate button */}
          <div style={s.footer}>
            <button
              type="button"
              onClick={hasResults ? handleRegenerate : handleGenerate}
              disabled={!canGenerate}
              style={{
                ...s.generateButton,
                ...(!canGenerate ? s.generateButtonDisabled : {}),
              }}
            >
              <span style={{ fontSize: 16 }}>✦</span>
              {isSubmitting
                ? "Generating..."
                : hasResults
                  ? "Regenerate"
                  : "Generate"}
            </button>
          </div>
        </div>

        {/* Loading state */}
        {isSubmitting && (
          <div style={s.loadingCard}>
            <div style={s.spinner} />
            <p style={s.loadingText}>
              Generating your {productType.name.toLowerCase()} design…
            </p>
            <p style={s.loadingSubtext}>
              This usually takes 10–15 seconds
            </p>
          </div>
        )}

        {/* Generation failed — prompt was saved but no images came back */}
        {generationFailed && (
          <div style={s.errorCard}>
            <p style={s.errorText}>
              Design generation didn't return images this time. Your prompt has
              been saved — try hitting <strong>Regenerate</strong> above.
            </p>
          </div>
        )}

        {/* ── Design results (inline PDP) ── */}
        {hasResults && !isSubmitting && (
          <div style={s.resultsSection}>
            {/* Main image */}
            <div style={s.mainImageContainer}>
              <img
                src={mainImage}
                alt="Generated design"
                style={s.mainImage}
              />
            </div>

            {/* Thumbnail row */}
            {generatedImages.length > 1 && (
              <div style={s.thumbnailRow}>
                {generatedImages.map((url, idx) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    style={{
                      ...s.thumbnail,
                      ...(idx === selectedImageIdx
                        ? s.thumbnailSelected
                        : {}),
                    }}
                  >
                    <img
                      src={url}
                      alt={`Variation ${idx + 1}`}
                      style={s.thumbnailImg}
                    />
                  </button>
                ))}
              </div>
            )}

            {/* ── Edit Design affordance ── */}
            <div style={s.editCard}>
              <div style={s.editRow}>
                <input
                  type="text"
                  placeholder='Describe a change… e.g. "make it more red" or "change floral to geometric"'
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canEdit) handleEdit();
                  }}
                  style={s.editInput}
                />
                <button
                  type="button"
                  onClick={handleEdit}
                  disabled={!canEdit}
                  style={{
                    ...s.editButton,
                    ...(!canEdit ? s.generateButtonDisabled : {}),
                  }}
                >
                  <span style={{ fontSize: 14 }}>✦</span>
                  Edit Design
                </button>
              </div>
            </div>

            {/* Actions */}
            <div style={s.resultsActions}>
              <button
                type="button"
                onClick={() =>
                  navigate(`/app/design/${savedProductId}/pricing`)
                }
                style={s.generateButton}
              >
                Continue to Pricing →
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate(`/app/categories/${productType.category.slug}`)
                }
                style={s.secondaryButton}
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
