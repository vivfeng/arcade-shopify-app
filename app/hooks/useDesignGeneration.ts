import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "../services/firebase/firebase";
import type {
  FirestoreDesign,
  FirestoreDesignVariant,
} from "../types/arcade";

interface DesignGenerationState {
  status: "idle" | "monitoring" | "complete" | "failed";
  imageUrls: string[];
  variants: FirestoreDesignVariant[];
  error?: string;
}

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

    const docRef = doc(getDb(), "designsFromPrompt", firestoreDocumentId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        const resultsMap = data.results_map as
          | Record<string, FirestoreDesign>
          | undefined;

        if (!resultsMap) return;

        const allVariants: FirestoreDesignVariant[] = [];
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
