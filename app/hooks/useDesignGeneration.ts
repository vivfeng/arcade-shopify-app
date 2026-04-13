import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface DesignVariantImage {
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

export interface DesignVariant {
  design_variant_image: DesignVariantImage;
}

export interface Design {
  design_variants: DesignVariant[];
}

interface DesignGenerationState {
  status: "idle" | "monitoring" | "complete" | "failed";
  /** Flat list of image URLs from all design variants. */
  imageUrls: string[];
  /** Full variant data if needed. */
  variants: DesignVariant[];
  error?: string;
}

/**
 * Subscribes to a Firestore document in the "designsFromPrompt" collection
 * and extracts image URLs from results_map -> design_variants -> design_variant_image.url.
 *
 * Usage:
 *   const { status, imageUrls } = useDesignGeneration(firestoreDocumentId);
 */
export function useDesignGeneration(firestoreDocumentId: string | null) {
  const [state, setState] = useState<DesignGenerationState>({
    status: "idle",
    imageUrls: [],
    variants: [],
  });

  const reset = useCallback(() => {
    setState({ status: "idle", imageUrls: [], variants: [] });
  }, []);

  useEffect(() => {
    if (!firestoreDocumentId) return;

    setState({ status: "monitoring", imageUrls: [], variants: [] });

    const docRef = doc(db, "designsFromPrompt", firestoreDocumentId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        const resultsMap = data.results_map as
          | Record<string, Design>
          | undefined;

        if (!resultsMap) return;

        // Extract all variants and image URLs from results_map
        const allVariants: DesignVariant[] = [];
        const allImageUrls: string[] = [];

        for (const design of Object.values(resultsMap)) {
          if (!design.design_variants) continue;
          for (const variant of design.design_variants) {
            allVariants.push(variant);
            if (variant.design_variant_image?.url) {
              allImageUrls.push(variant.design_variant_image.url);
            }
          }
        }

        if (allImageUrls.length > 0) {
          setState({
            status: "complete",
            imageUrls: allImageUrls,
            variants: allVariants,
          });
        }
      },
      (error) => {
        setState({
          status: "failed",
          imageUrls: [],
          variants: [],
          error: error.message,
        });
      },
    );

    return () => unsubscribe();
  }, [firestoreDocumentId]);

  return { ...state, reset };
}
