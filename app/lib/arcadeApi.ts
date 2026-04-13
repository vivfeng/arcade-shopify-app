// Arcade staging backend integration for the design-from-prompt async flow.
//
// Flow:
//   1. POST /api/design-from-prompt-async with prompt + category.
//   2. API returns firestore_document_id + dream_id immediately.
//   3. Monitor Firestore collection "designsFromPrompt" for that document ID
//      until status reaches "complete" (statuses: kickoff_sent -> ... -> complete).
//   4. Firestore doc contains results_map -> design_variants -> image URLs.
//   5. For fresh data after DB changes, use POST /public/batch/design-variants.
//
// Auth: X-Vercel-Authorization header with API key.
// Pointed at staging only.

const ARCADE_API_URL =
  process.env.ARCADE_API_URL || "https://api.staging.arcade.ai";
const ARCADE_API_KEY = process.env.ARCADE_API_KEY || "";

const REQUEST_TIMEOUT_MS = 60_000;

// --- Types ---

export interface DesignGenerationRequest {
  prompt: string;
  /** Color hex codes for inspiration (max 3). */
  inspirationColorHexcodes?: string[];
  /** UUID of an artist to apply style constraints. */
  artistId?: string;
  /** URLs of inspiration images (max 3). Uploaded to GCS first. */
  inspirationImageUrls?: string[];
}

/** Immediate response from POST /api/design-from-prompt-async. */
export interface DesignGenerationResponse {
  firestoreDocumentId: string;
  dreamId?: string;
  usage?: DesignGenerationUsage;
}

export interface DesignGenerationUsage {
  generationLimitMessage?: string | null;
  willBeChargedForOverage: boolean;
  remainingIncludedGenerations?: number | null;
  overageGenerations?: number | null;
}

/** Image data from a design variant. */
export interface DesignVariantImage {
  id?: string;
  url: string;
  modifiedPrompt: string;
  aiModel: {
    id: string;
    artist?: {
      displayName: string;
      id: string;
      name: string;
    };
  };
}

/** A single design variant returned from Firestore or the batch endpoint. */
export interface DesignVariant {
  id: string;
  designVariantImage: DesignVariantImage;
}

// --- Helpers ---

async function arcadeFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${ARCADE_API_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(ARCADE_API_KEY
        ? { "X-Vercel-Authorization": ARCADE_API_KEY }
        : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Arcade API error ${response.status} on ${path}: ${body}`,
    );
  }

  return response;
}

// --- Public API ---

/**
 * Kick off an async design generation.
 *
 * Endpoint: POST /api/design-from-prompt-async
 * Returns a Firestore document ID to monitor for completion.
 */
export async function requestDesignGeneration(
  req: DesignGenerationRequest,
): Promise<DesignGenerationResponse> {
  const response = await arcadeFetch("/api/design-from-prompt-async", {
    method: "POST",
    body: JSON.stringify({
      prompt: req.prompt,
      generation_type: "text_prompt",
      category_name: "Decorative Pillows",
      number_of_designs: 4,
      ...(req.inspirationColorHexcodes?.length
        ? { inspiration_color_hexcodes: req.inspirationColorHexcodes }
        : {}),
      ...(req.artistId ? { artist_id: req.artistId } : {}),
      ...(req.inspirationImageUrls?.length
        ? { inspiration_image_urls: req.inspirationImageUrls }
        : {}),
    }),
  });

  const data = await response.json();

  return {
    firestoreDocumentId: data.firestore_document_id,
    dreamId: data.dream_id,
    usage: data.usage
      ? {
          generationLimitMessage: data.usage.generation_limit_message,
          willBeChargedForOverage: data.usage.will_be_charged_for_overage,
          remainingIncludedGenerations:
            data.usage.remaining_included_generations,
          overageGenerations: data.usage.overage_generations,
        }
      : undefined,
  };
}

// --- Legacy-shaped types & functions ---
// Used by the prompt route's edit/regenerate intents.
// These endpoints are NOT yet confirmed via Swagger — the request shapes
// are provisional and will be updated once we have the real API specs.

export interface DesignRegenerateRequest {
  generationId: string;
  prompt: string;
  generationType: string;
  colors?: string;
  artistStyle?: string;
  referenceImageUrl?: string;
}

export interface DesignEditRequest {
  generationId: string;
  editInstruction: string;
  shopId: string;
}

/** Legacy response shape used by edit/regenerate/poll flows. */
export interface LegacyGenerationResponse {
  documentId: string;
  generationId?: string;
}

export interface DesignDocument {
  documentId: string;
  generationId?: string;
  status: "pending" | "processing" | "completed" | "failed";
  makerImageUrl?: string;
  patternUrl?: string;
  imageUrls?: string[];
  suggestedTitle?: string;
  suggestedDescription?: string;
  parentGenerationId?: string;
}

/** TODO: Regenerate endpoint — need Swagger confirmation. */
export async function requestDesignRegenerate(
  _req: DesignRegenerateRequest,
): Promise<LegacyGenerationResponse> {
  throw new Error(
    "requestDesignRegenerate is not yet implemented — awaiting Swagger confirmation for the regenerate endpoint",
  );
}

/** TODO: Edit endpoint — need Swagger confirmation. */
export async function requestDesignEdit(
  _req: DesignEditRequest,
): Promise<LegacyGenerationResponse> {
  throw new Error(
    "requestDesignEdit is not yet implemented — awaiting Swagger confirmation for the edit endpoint",
  );
}

/** TODO: Poll endpoint — Firestore subscription replaces HTTP polling. */
export async function pollDesignDocument(
  _documentId: string,
): Promise<DesignDocument> {
  throw new Error(
    "pollDesignDocument is not yet implemented — use the useDesignGeneration Firestore hook instead",
  );
}

/**
 * Fetch design variants by their IDs from the Arcade backend.
 * Use this to get fresh image URLs after Firestore completion,
 * or when DB data has changed since the Firestore doc was written.
 *
 * Endpoint: POST /public/batch/design-variants
 */
export async function bulkFetchVariants(
  variantIds: string[],
): Promise<DesignVariant[]> {
  const response = await arcadeFetch("/public/batch/design-variants", {
    method: "POST",
    body: JSON.stringify({ variant_ids: variantIds }),
  });

  const data = await response.json();

  return (data ?? [])
    .filter((v: DesignVariant | null): v is DesignVariant => v !== null)
    .map((v: Record<string, unknown>) => ({
      id: v.id,
      designVariantImage: {
        id: (v.design_variant_image as Record<string, unknown>)?.id,
        url: (v.design_variant_image as Record<string, unknown>)?.url,
        modifiedPrompt: (v.design_variant_image as Record<string, unknown>)
          ?.modified_prompt,
        aiModel: (v.design_variant_image as Record<string, unknown>)?.ai_model,
      },
    }));
}
