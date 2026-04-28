export interface DesignGenerationRequest {
  prompt: string;
  inspirationColorHexcodes?: string[];
  artistId?: string;
  inspirationImageUrls?: string[];
}

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

export interface DesignVariant {
  id: string;
  designVariantImage: DesignVariantImage;
}

export interface FirestoreDesignVariantImage {
  id?: string;
  url: string;
  modified_prompt: string;
  ai_model: {
    id: string;
    artist?: {
      display_name: string;
      id: string;
      name: string;
    };
  };
}

export interface FirestoreDesignVariant {
  design_variant_image: FirestoreDesignVariantImage;
}

export interface FirestoreDesign {
  design_variants: FirestoreDesignVariant[];
}

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
