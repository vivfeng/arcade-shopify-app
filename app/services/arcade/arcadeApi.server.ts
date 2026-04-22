import {
  getValidArcadeToken,
  evictTokenCache,
} from "./arcadeAuth.server";
import { env } from "../../lib/env/env.server";
import type {
  DesignGenerationRequest,
  DesignGenerationResponse,
  DesignVariant,
  DesignRegenerateRequest,
  DesignEditRequest,
  LegacyGenerationResponse,
  DesignDocument,
} from "../../types/arcade";

export {
  resolveArcadeAccountId,
  createClientAuthToken,
  getArcadeAccountIdForShop,
  requireArcadeAccountIdForApi,
  linkShopToArcadeAccount,
} from "./arcadeAuth.server";

export type {
  DesignGenerationRequest,
  DesignGenerationResponse,
  DesignGenerationUsage,
  DesignVariantImage,
  DesignVariant,
  DesignRegenerateRequest,
  DesignEditRequest,
  LegacyGenerationResponse,
  DesignDocument,
} from "../../types/arcade";

const ARCADE_API_URL = env.ARCADE_API_URL;
const ARCADE_API_KEY = env.ARCADE_API_KEY;

/** Maker-service checks this to apply Shopify-only rules (e.g. maker allowlist). */
export const ARCADE_SHOPIFY_APP_HEADER = "arcade-shopify-app";

const REQUEST_TIMEOUT_MS = 60_000;

async function arcadeFetch(
  path: string,
  options: RequestInit,
  arcadeAccountId: string,
): Promise<Response> {
  const url = `${ARCADE_API_URL}${path}`;

  const doRequest = async (token: string) => {
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        ...(ARCADE_API_KEY ? { "X-Vercel-Authorization": ARCADE_API_KEY } : {}),
        ...options.headers,
        [ARCADE_SHOPIFY_APP_HEADER]: "1",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  };

  let token = await getValidArcadeToken(arcadeAccountId);
  let response = await doRequest(token);

  if (response.status === 401) {
    console.warn(
      `[ArcadeAPI] 401 on ${path} — minting fresh token for ${arcadeAccountId}`,
    );
    evictTokenCache(arcadeAccountId);
    token = await getValidArcadeToken(arcadeAccountId, true);
    response = await doRequest(token);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Arcade API error ${response.status} on ${path}: ${body}`,
    );
  }

  return response;
}

export async function requestDesignGeneration(
  req: DesignGenerationRequest,
  arcadeAccountId: string,
): Promise<DesignGenerationResponse> {
  const response = await arcadeFetch(
    "/api/design-from-prompt-async",
    {
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
    },
    arcadeAccountId,
  );

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

export async function requestDesignRegenerate(
  _req: DesignRegenerateRequest,
): Promise<LegacyGenerationResponse> {
  throw new Error(
    "requestDesignRegenerate is not yet implemented — awaiting Swagger confirmation for the regenerate endpoint",
  );
}

export async function requestDesignEdit(
  _req: DesignEditRequest,
): Promise<LegacyGenerationResponse> {
  throw new Error(
    "requestDesignEdit is not yet implemented — awaiting Swagger confirmation for the edit endpoint",
  );
}

export async function pollDesignDocument(
  _documentId: string,
): Promise<DesignDocument> {
  throw new Error(
    "pollDesignDocument is not yet implemented — use the useDesignGeneration Firestore hook instead",
  );
}

export async function bulkFetchVariants(
  variantIds: string[],
  arcadeAccountId: string,
): Promise<DesignVariant[]> {
  const response = await arcadeFetch(
    "/public/batch/design-variants",
    {
      method: "POST",
      body: JSON.stringify({ variant_ids: variantIds }),
    },
    arcadeAccountId,
  );

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
