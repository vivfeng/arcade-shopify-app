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
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  Wand2,
  Crosshair,
  Palette,
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
  onOpenEditor: () => void;
};

function DesignResultCard({
  imageUrl,
  imageIndex,
  alt,
  selected,
  onSelect,
  onOpenEditor,
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
            onOpenEditor();
          }}
          className="inline-flex size-9 items-center justify-center rounded-full border border-card-border bg-primary text-card shadow-[0_1px_4px_rgba(15,15,15,0.12)] transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          aria-label={`Refine design ${imageIndex + 1}`}
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
  const editFetcher = useFetcher<{ error?: string }>({
    key: "prompt-design-edit",
  });

  const [prompt, setPrompt] = useState("");
  const [inspirationColors, setInspirationColors] = useState<
    CreateInspirationColor[]
  >([]);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [editInstruction, setEditInstruction] = useState("");
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const editorModalTitleId = useId();
  const editInstructionRef = useRef<HTMLTextAreaElement>(null);

  const [firestoreDocId, setFirestoreDocId] = useState<string | null>(null);
  const design = useDesignGeneration(firestoreDocId);

  const typewriterHints = [
    `Create a ${productType.name.toLowerCase()} with soft botanical motifs…`,
    `Design ${productType.name.toLowerCase()} in warm earth tones and a hand-painted feel…`,
    `Make a bold geometric ${productType.name.toLowerCase()} for a modern space…`,
  ];

  useEffect(() => {
    if (fetcher.data?.arcadeDocumentId) {
      setFirestoreDocId(fetcher.data.arcadeDocumentId);
    }
  }, [fetcher.data?.arcadeDocumentId]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!editorModalOpen) return;
    const focusTimer = window.setTimeout(() => {
      editInstructionRef.current?.focus();
    }, 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setEditorModalOpen(false);
        setEditInstruction("");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [editorModalOpen]);

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
    setEditInstruction("");
    setEditorModalOpen(false);
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
    setEditInstruction("");
    setEditorModalOpen(false);
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

  const isEditSubmitting = editFetcher.state !== "idle";
  const canSubmitEdit =
    editInstruction.trim().length > 0 &&
    savedProductId != null &&
    !isLoading &&
    !isEditSubmitting;

  const handleCloseEditorModal = useCallback(() => {
    setEditorModalOpen(false);
    setEditInstruction("");
  }, []);

  const handleEdit = useCallback(() => {
    if (!canSubmitEdit || !savedProductId) return;

    editFetcher.submit(
      {
        intent: "edit",
        parentProductId: savedProductId,
        editInstruction: editInstruction.trim(),
      },
      { method: "post" },
    );
  }, [canSubmitEdit, savedProductId, editInstruction, editFetcher]);

  const editModalError = editFetcher.data?.error ?? null;
  const editorPreviewUrl =
    generatedImages[selectedImageIdx] ?? generatedImages[0] ?? null;

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
                      onOpenEditor={() => {
                        setSelectedImageIdx(idx);
                        setEditorModalOpen(true);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <DesignResultCard
                  imageUrl={generatedImages[0]}
                  imageIndex={0}
                  alt="Generated design"
                  selected={false}
                  onSelect={() => setSelectedImageIdx(0)}
                  onOpenEditor={() => {
                    setSelectedImageIdx(0);
                    setEditorModalOpen(true);
                  }}
                />
              )}

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

      {portalReady &&
        editorModalOpen &&
        editorPreviewUrl &&
        typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-end justify-center p-3 sm:items-center sm:p-6">
              <button
                type="button"
                className="absolute inset-0 cursor-pointer border-none bg-black/45 p-0"
                aria-label="Close editor"
                onClick={handleCloseEditorModal}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={editorModalTitleId}
                className="relative z-10 flex max-h-[min(92vh,48rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-card-border bg-card shadow-[0_16px_48px_rgba(15,15,15,0.18)]"
              >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-card-border px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <h2
                      id={editorModalTitleId}
                      className="m-0 font-display text-lg font-semibold tracking-tight text-primary"
                    >
                      Refine design
                    </h2>
                    <p className="mb-0 mt-1 text-[13px] leading-snug text-subdued">
                      Descriptive changes run from this dialog. Mask-based precise
                      edit and cluster recolor match Arcade Lab’s Refine page; those
                      flows are not wired into Shopify yet.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseEditorModal}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-card-border bg-card text-primary hover:bg-surface-muted"
                    aria-label="Close"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                  <div className="overflow-hidden rounded-lg border border-card-border bg-surface-muted">
                    <img
                      src={editorPreviewUrl}
                      alt="Design being edited"
                      className="aspect-square w-full object-cover"
                    />
                  </div>
                  {editModalError ? (
                    <div className="mt-4">
                      <ErrorBanner message={editModalError} />
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-0 rounded-lg border border-card-border bg-card/50">
                    <details
                      open
                      className="group border-b border-card-border px-3 last:border-b-0 sm:px-4"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
                        <Wand2
                          className="size-4 shrink-0 text-gold-dark"
                          aria-hidden="true"
                        />
                        Descriptive edit
                      </summary>
                      <div className="space-y-3 pb-4 pl-6 sm:pl-7">
                        <p className="m-0 text-[13px] leading-snug text-subdued">
                          Describe a change for the entire image (matches Arcade
                          Lab’s descriptive refine).
                        </p>
                        <label className="block">
                          <span className="sr-only">Edit instructions</span>
                          <textarea
                            ref={editInstructionRef}
                            id="design-edit-instructions"
                            rows={4}
                            value={editInstruction}
                            onChange={(e) => setEditInstruction(e.target.value)}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                (e.metaKey || e.ctrlKey) &&
                                canSubmitEdit
                              ) {
                                e.preventDefault();
                                handleEdit();
                              }
                            }}
                            placeholder="Describe the change you want to make to the entire pattern…"
                            className="w-full resize-y rounded-lg border border-card-border bg-transparent px-3 py-2.5 text-sm leading-relaxed text-primary outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleEdit}
                          disabled={!canSubmitEdit}
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border-none bg-primary px-5 text-sm font-semibold text-card disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isEditSubmitting ? (
                            <Loader2
                              className="size-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Wand2 className="size-4" aria-hidden="true" />
                          )}
                          {isEditSubmitting ? "Generating…" : "Generate"}
                        </button>
                        <p className="m-0 text-[11px] text-subdued">
                          Shortcut: ⌘ or Ctrl + Enter
                        </p>
                      </div>
                    </details>

                    <details className="group border-b border-card-border px-3 last:border-b-0 sm:px-4">
                      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
                        <Crosshair
                          className="size-4 shrink-0 text-gold-dark"
                          aria-hidden="true"
                        />
                        Precise edit
                      </summary>
                      <div className="space-y-2 pb-4 pl-6 text-[13px] leading-snug text-subdued sm:pl-7">
                        <p className="m-0">
                          In Arcade Lab you paint a mask on the image and describe
                          the change for that region only; the server fuses mask +
                          prompt via an inpaint modal.
                        </p>
                        <p className="m-0">
                          This embedded app does not include the mask canvas or
                          edit session APIs yet—use Arcade Lab → Refine for precise
                          edits.
                        </p>
                      </div>
                    </details>

                    <details className="group px-3 sm:px-4">
                      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
                        <Palette
                          className="size-4 shrink-0 text-gold-dark"
                          aria-hidden="true"
                        />
                        Recolor
                      </summary>
                      <div className="space-y-2 pb-4 pl-6 text-[13px] leading-snug text-subdued sm:pl-7">
                        <p className="m-0">
                          Arcade Lab detects dominant colors, lets you map each
                          cluster to a new color (including Pantone picks), then
                          applies the recolor in one step.
                        </p>
                        <p className="m-0">
                          That prepare-and-apply pipeline is not available in the
                          Shopify app until the same backend endpoints are exposed
                          here.
                        </p>
                      </div>
                    </details>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCloseEditorModal}
                      className="h-10 rounded-lg border border-card-border bg-card px-4 text-sm font-medium text-secondary"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <CreationPromptBar
        prompt={prompt}
        onPromptChange={setPrompt}
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
