import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
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
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const prompt = formData.get("prompt") as string;
  const productTypeId = formData.get("productTypeId") as string;

  if (!prompt || !productTypeId) {
    return json({ error: "Prompt and product type are required" }, { status: 400 });
  }

  // Scope the shop lookup to the authenticated session. Using findFirst
  // here (the previous behavior) would attach new products to whichever
  // Shop row happened to sort first in a multi-store install — see
  // ADR 0001 blocker B3 and the "Ticket requirements" rule in README.md.
  const shop = await db.shop.findUnique({
    where: { domain: session.shop },
    select: { id: true },
  });

  if (!shop) {
    return json({ error: "Shop not found for authenticated session" }, { status: 400 });
  }

  // TODO(AII-826): Call Arcade AI design API.
  // The implementation must target React Router, not Remix — see
  // `docs/adr/0001-remix-to-react-router.md`. Do not introduce new
  // `@remix-run/*` imports in the ticket that picks this up.
  // For now, create a draft product scoped to the authenticated shop.
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
    color: "#988c52",
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "'Instrument Sans', sans-serif",
  },
  heading: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: "#0f0f0f",
    letterSpacing: "-0.52px",
    lineHeight: "28.6px",
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    color: "#696864",
    fontFamily: "'Instrument Sans', sans-serif",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #deddd5",
    borderRadius: 12,
    boxShadow: "0px 1px 4px 0px rgba(0,0,0,0.06)",
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
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: 15,
    lineHeight: "22px",
    color: "#0f0f0f",
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
    borderRadius: 16,
    border: "1px solid #deddd5",
    background: "#ffffff",
    cursor: "pointer",
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: 13,
    fontWeight: 500,
    color: "#0f0f0f",
    transition: "border-color 150ms ease, background 150ms ease",
  },
  chipActive: {
    background: "#f3eec5",
    borderColor: "#d4ce9e",
    color: "#6b6339",
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
    borderRadius: 8,
    border: "none",
    background: "#0f0f0f",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Instrument Sans', sans-serif",
    cursor: "pointer",
  },
  generateButtonDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  divider: {
    width: "100%",
    height: 1,
    background: "#e9e5d8",
    border: "none",
    margin: 0,
  },
  // Chip dropdown
  dropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    background: "#ffffff",
    border: "1px solid #deddd5",
    borderRadius: 8,
    boxShadow: "0px 4px 12px rgba(0,0,0,0.1)",
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
    fontFamily: "'Instrument Sans', sans-serif",
    fontSize: 13,
    color: "#0f0f0f",
  },
  // Draft-saved confirmation card. The full AI design + pricing screens
  // are not shipped yet (tracked in ADR 0001 M0), so on success we stay
  // on this page and surface a confirmation instead of navigating to a
  // route that does not exist.
  successCard: {
    background: "#ffffff",
    border: "1px solid #deddd5",
    borderRadius: 12,
    boxShadow: "0px 1px 4px 0px rgba(0,0,0,0.06)",
    padding: 24,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start" as const,
    gap: 14,
  },
  successBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    background: "#e8f8ed",
    color: "#2ca84f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    fontWeight: 600,
  },
  successHeading: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: "#0f0f0f",
    fontFamily: "'Instrument Sans', sans-serif",
  },
  successSubtext: {
    margin: "4px 0 0",
    fontSize: 13,
    lineHeight: "20px",
    color: "#696864",
    fontFamily: "'Instrument Sans', sans-serif",
  },
  successActions: {
    display: "flex",
    gap: 8,
    marginTop: 4,
  },
  successPrimary: {
    height: 40,
    padding: "0 16px",
    background: "#0f0f0f",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'Instrument Sans', sans-serif",
    cursor: "pointer",
  },
  successSecondary: {
    height: 40,
    padding: "0 16px",
    background: "#ffffff",
    color: "#45413b",
    border: "1px solid #deddd5",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'Instrument Sans', sans-serif",
    cursor: "pointer",
  },
  successDraftId: {
    margin: 0,
    fontSize: 10,
    color: "#988c52",
    fontFamily: "'DM Mono', monospace",
    letterSpacing: "0.3px",
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
                background: opt === value ? "#f7f4f0" : "transparent",
              }}
              onClick={() => {
                onSelect(opt);
                setOpen(false);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f7f4f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  opt === value ? "#f7f4f0" : "transparent";
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

  // The full AI design + pricing flow is not shipped yet (tracked in
  // ADR 0001 M0). On success, stay on this page and surface a draft
  // confirmation instead of navigating to `/app/design/:id`, which
  // does not exist as a route yet. See review finding #3 and
  // docs/tickets/artsem-review-epic.md subticket fix 2.
  const savedProductId =
    fetcher.data && "productId" in fetcher.data
      ? fetcher.data.productId
      : null;

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
            {savedProductId
              ? "Your draft prompt has been saved."
              : "Describe your design and let AI create it for you"}
          </p>
        </div>

        {savedProductId ? (
          /* Draft saved — in-place confirmation */
          <div style={s.successCard}>
            <div style={s.successBadge} aria-hidden="true">
              ✓
            </div>
            <div>
              <h2 style={s.successHeading}>Draft saved</h2>
              <p style={s.successSubtext}>
                We've stored your prompt for this{" "}
                {productType.name.toLowerCase()}. The AI design studio
                and pricing flow are coming soon — you'll be notified
                when they're ready.
              </p>
            </div>
            <div style={s.successActions}>
              <button
                type="button"
                onClick={() =>
                  navigate(`/app/categories/${productType.category.slug}`)
                }
                style={s.successPrimary}
              >
                Create another draft
              </button>
              <button
                type="button"
                onClick={() => navigate("/app/categories")}
                style={s.successSecondary}
              >
                Browse categories
              </button>
            </div>
            <p style={s.successDraftId}>Draft id: {savedProductId}</p>
          </div>
        ) : (
          /* Prompt card */
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
        )}
      </div>
    </Page>
  );
}
