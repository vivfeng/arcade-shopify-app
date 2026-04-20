import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import type { CreateInspirationColor } from "../../lib/inspirationColors";
import { getInspirationColorSummary } from "../../lib/inspirationColors";

const InspirationColorPickerLazy = lazy(async () => {
  const mod = await import("./InspirationColorPicker");
  return { default: mod.InspirationColorPicker };
});

type InspirationColorsTriggerProps = {
  selectedColors: CreateInspirationColor[];
  onColorsChange: (colors: CreateInspirationColor[]) => void;
  disabled?: boolean;
};

export function InspirationColorsTrigger({
  selectedColors,
  onColorsChange,
  disabled = false,
}: InspirationColorsTriggerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const summary = getInspirationColorSummary(selectedColors);
  const hasSelection = selectedColors.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        title={summary}
        onClick={() => {
          if (!disabled) {
            setOpen((v) => !v);
          }
        }}
        className={`inline-flex items-center gap-1.5 h-9 min-h-9 max-w-[12rem] rounded-full border px-3.5 text-[13px] font-semibold shadow-[0_1px_0_rgba(15,15,15,0.04)] cursor-pointer transition-[background-color,border-color,color,box-shadow] sm:max-w-[14rem] ${
          hasSelection
            ? "border-gold-border bg-gold-pale text-gold-dark"
            : "border-card-border bg-card/90 text-primary hover:border-card-border-hover"
        } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
      >
        <Palette className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{summary}</span>
      </button>

      {open ? (
        <div
          className="absolute bottom-[calc(100%+8px)] left-0 z-[120] w-[min(30rem,calc(100vw-2rem))] max-w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-card-border bg-card shadow-dropdown"
          role="dialog"
          aria-label="Inspiration colors"
        >
          <Suspense
            fallback={
              <div className="flex h-[25rem] items-center justify-center text-sm text-subdued">
                Loading colors…
              </div>
            }
          >
            <InspirationColorPickerLazy
              open={open}
              selectedColors={selectedColors}
              onColorsChange={onColorsChange}
            />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
}
