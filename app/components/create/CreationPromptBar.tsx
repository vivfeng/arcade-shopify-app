import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { useTypewriter } from "../../hooks/useTypewriter";
import type { CreateInspirationColor } from "../../lib/inspirationColors";

const MAX_PROMPT_LENGTH = 4096;

type CreationPromptBarProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  typewriterHints: string[];
  referencePreviewUrl: string | null;
  referenceLabel: string | null;
  onClearReference: () => void;
  filterSlot: ReactNode;
  inspirationColors: CreateInspirationColor[];
  onInspirationColorsChange: (colors: CreateInspirationColor[]) => void;
  onGenerate: () => void;
  canGenerate: boolean;
  isGenerating: boolean;
  hasResults: boolean;
};

export function CreationPromptBar({
  prompt,
  onPromptChange,
  typewriterHints,
  referencePreviewUrl,
  referenceLabel,
  onClearReference,
  filterSlot,
  inspirationColors,
  onInspirationColorsChange,
  onGenerate,
  canGenerate,
  isGenerating,
  hasResults,
}: CreationPromptBarProps) {
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const hasInput = prompt.length > 0;
  const typewriterText = useTypewriter(typewriterHints, hasInput);

  const isActive =
    hasInput ||
    referencePreviewUrl !== null ||
    inspirationColors.length > 0;

  useEffect(() => {
    const element = promptRef.current;
    if (!element) {
      return;
    }
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [prompt]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (canGenerate && !isGenerating) {
        onGenerate();
      }
    }
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onPromptChange(event.target.value);
  };

  const generateTitle = "Shortcut: ⌘ + Enter";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] pb-3 sm:pb-5">
      <div className="pointer-events-auto mx-auto w-full max-w-[52rem] px-3 sm:px-6 lg:max-w-[56rem]">
        <div className="relative">
          <div
            className={`pointer-events-none absolute -inset-3 z-0 transition-opacity duration-700 sm:-inset-4 ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden="true"
          >
            <div
              className="absolute left-[10%] top-[20%] h-[70%] w-[45%] rounded-full bg-gold/25 blur-[48px]"
              style={{ animation: "creation-glow-1 8s ease-in-out infinite" }}
            />
            <div
              className="absolute right-[8%] top-[10%] h-[80%] w-[40%] rounded-full bg-gold/20 blur-[52px]"
              style={{ animation: "creation-glow-2 10s ease-in-out infinite" }}
            />
            <div
              className="absolute bottom-[5%] left-[28%] h-[60%] w-[50%] rounded-full bg-gold/20 blur-[56px]"
              style={{ animation: "creation-glow-3 12s ease-in-out infinite" }}
            />
          </div>

          <div
            className="relative z-10 rounded-[26px] border border-card-border/80 bg-card/95 px-3.5 py-3 shadow-[0_18px_42px_rgba(15,15,15,0.08)] ring-1 ring-card-border/40 backdrop-blur-md sm:rounded-[32px] sm:px-5 sm:py-4"
          >
            {referencePreviewUrl ? (
              <div className="mb-3 flex flex-wrap gap-2">
                <div className="group relative inline-flex overflow-hidden rounded-[18px] border border-card-border bg-card shadow-[0_8px_20px_rgba(15,15,15,0.06)]">
                  <img
                    src={referencePreviewUrl}
                    alt={referenceLabel ?? "Reference"}
                    className="h-28 w-28 object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Remove reference image"
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-card opacity-100 shadow-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                    onClick={onClearReference}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}

            {inspirationColors.length > 0 ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {inspirationColors.map((color) => (
                  <span
                    key={color.token}
                    className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-card-border bg-page/80 px-3 py-1.5 text-primary shadow-[0_1px_0_rgba(15,15,15,0.04)]"
                  >
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 rounded-full border border-black/10"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="max-w-[10rem] truncate text-[12px] font-medium text-secondary">
                      {color.label}
                    </span>
                  </span>
                ))}
                <button
                  type="button"
                  aria-label="Clear inspiration colors"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-card-border bg-card/90 text-subdued shadow-[0_1px_0_rgba(15,15,15,0.04)] transition-colors hover:border-card-border-hover hover:bg-page hover:text-primary"
                  onClick={() => onInspirationColorsChange([])}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            <div className="relative">
              {!hasInput ? (
                <div
                  className="pointer-events-none absolute inset-0 select-none text-sm leading-7 text-subdued/55 sm:text-[15px] sm:leading-8"
                  aria-hidden="true"
                >
                  {typewriterText}
                  <span className="ml-px inline-block w-px animate-pulse">|</span>
                </div>
              ) : null}
              <textarea
                ref={promptRef}
                id="creation-prompt"
                value={prompt}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                rows={2}
                maxLength={MAX_PROMPT_LENGTH}
                className="relative min-h-[4.75rem] w-full resize-none overflow-hidden border-none bg-transparent px-0 py-0 pr-11 text-sm leading-7 text-primary outline-none sm:text-[15px] sm:leading-8"
                placeholder=""
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {filterSlot}
              </div>

              <div className="ml-auto flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={!canGenerate || isGenerating}
                  aria-label={
                    isGenerating
                      ? "Generating design"
                      : hasResults
                        ? "Regenerate design"
                        : "Generate design"
                  }
                  title={generateTitle}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border-none bg-primary text-card shadow-[0_2px_8px_rgba(15,15,15,0.12)] transition-[transform,opacity,background-color] hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-40 sm:size-[42px]"
                >
                  {isGenerating ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles
                      className="size-4 sm:size-[1.05rem]"
                      fill="currentColor"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
