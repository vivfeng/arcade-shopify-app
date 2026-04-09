import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { colors, fonts, radius, shadows } from "../lib/tokens";
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

  return json({ productType });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const prompt = formData.get("prompt") as string;
  const productTypeId = formData.get("productTypeId") as string;
  const colors = formData.get("colors") as string;
  const artist = formData.get("artist") as string;

  if (!prompt || !productTypeId) {
    return json({ error: "Prompt and product type are required" }, { status: 400 });
  }

  // TODO: Call Arcade AI design API when AII-826 is implemented
  // For now, create a draft product with the prompt
  const shop = await db.shop.findFirst({
    where: { domain: { not: "" } },
    select: { id: true },
  });

  if (!shop) {
    return json({ error: "Shop not found" }, { status: 400 });
  }

  const product = await db.arcadeProduct.create({
    data: {
      designPrompt: prompt,
      shopId: shop.id,
      productTypeId,
      status: "DRAFT",
    },
  });

  return json({ productId: product.id });
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
  const fetcher = useFetcher<{ productId?: string; error?: string }>();

  const [prompt, setPrompt] = useState("");
  const [selectedColors, setSelectedColors] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);

  const isSubmitting = fetcher.state !== "idle";
  const canGenerate = prompt.trim().length > 0 && !isSubmitting;

  // Navigate to design flow on success
  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;

    // Build the full prompt with structured inputs
    let fullPrompt = prompt.trim();
    if (selectedColors) fullPrompt += `\nColors: ${selectedColors}`;
    if (selectedArtist) fullPrompt += `\nStyle: ${selectedArtist}`;

    fetcher.submit(
      {
        prompt: fullPrompt,
        productTypeId: productType.id,
        colors: selectedColors || "",
        artist: selectedArtist || "",
      },
      { method: "post" },
    );
  }, [canGenerate, prompt, selectedColors, selectedArtist, productType.id, fetcher]);

  // Navigate on successful generation
  if (fetcher.data?.productId) {
    navigate(`/app/design/${fetcher.data.productId}`);
  }

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

        {/* Prompt card */}
        <div style={s.card}>
          {/* Text area */}
          <textarea
            style={s.textarea}
            placeholder={`Describe your ${productType.name.toLowerCase()} design...\n\nFor example: "A floral pattern with soft peonies and eucalyptus leaves, hand-painted feel, light cream background"`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <hr style={s.divider} />

          {/* Structured input chips */}
          <div style={s.chipsRow}>
            {/* Category chip — pre-filled */}
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

            {/* Colors chip */}
            <ChipDropdown
              icon="◕"
              label="Colors"
              value={selectedColors}
              options={COLOR_OPTIONS}
              onSelect={setSelectedColors}
            />

            {/* Artist chip */}
            <ChipDropdown
              icon="✦"
              label="Artist"
              value={selectedArtist}
              options={ARTIST_STYLES}
              onSelect={setSelectedArtist}
            />

            {/* Image chip */}
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

          {/* Generate button */}
          <div style={s.footer}>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              style={{
                ...s.generateButton,
                ...(!canGenerate ? s.generateButtonDisabled : {}),
              }}
            >
              <span style={{ fontSize: 16 }}>✦</span>
              {isSubmitting ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      </div>
    </Page>
  );
}
