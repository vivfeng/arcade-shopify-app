import type { CSSProperties, MouseEvent } from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, Search, X } from "lucide-react";
import { loadPantoneCatalog } from "../../lib/color-picker/catalog";
import {
  groupPantonesByFamily,
  parseColorQuery,
  rgbToHex,
  searchPantones,
} from "../../lib/color-picker/helpers";
import type { PantoneIndexedColor } from "../../lib/color-picker/types";
import {
  MAX_CREATE_INSPIRATION_COLORS,
  type CreateInspirationColor,
} from "../../lib/inspirationColors";

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

type InspirationColorPickerProps = {
  open: boolean;
  selectedColors: readonly CreateInspirationColor[];
  onColorsChange: (colors: CreateInspirationColor[]) => void;
};

const acceptedImageTypes = "image/png,image/jpeg,image/webp,image/gif";
const LIBRARY_GRID_COLUMNS = 7;

const buildPantoneSelection = (color: PantoneIndexedColor): CreateInspirationColor => ({
  kind: "pantone",
  token: color.id,
  label: color.label,
  hex: color.hex,
  rgb: color.rgb,
});

const buildSampledSelection = (hex: string): CreateInspirationColor | null => {
  const parsed = parseColorQuery(hex);
  if (parsed === null) {
    return null;
  }
  return {
    kind: "sampled",
    token: parsed.hex,
    label: parsed.hex.toUpperCase(),
    hex: parsed.hex,
    rgb: parsed.rgb,
  };
};

const getSelectionReferenceLabel = (color: CreateInspirationColor): string => {
  if (color.kind !== "pantone") {
    return color.hex.toUpperCase();
  }
  const tokenParts = color.token.split(":");
  const rawCode = tokenParts[tokenParts.length - 1] ?? color.token;
  if (!/[0-9]/.test(rawCode)) {
    return color.hex.toUpperCase();
  }
  return rawCode
    .split("-")
    .map((part) => part.toUpperCase())
    .join(" ");
};

const SelectedColorsBar = ({
  colors,
  onRemove,
}: {
  colors: readonly CreateInspirationColor[];
  onRemove: (token: string) => void;
}) => {
  if (colors.length === 0) {
    return null;
  }
  return (
    <div className="-mx-4 mt-3 flex items-center gap-3 border-t border-card-border/50 px-4 py-2.5">
      <div className="shrink-0 text-[11px] font-medium text-subdued">
        {colors.length} / {MAX_CREATE_INSPIRATION_COLORS}
      </div>
      <div className="flex -space-x-1">
        {colors.map((color) => (
          <button
            key={color.token}
            type="button"
            onClick={() => onRemove(color.token)}
            className="group relative"
            title={`Remove ${color.label}`}
          >
            <div
              className="size-6 rounded-full ring-1 ring-white transition-transform group-hover:scale-95"
              style={{ backgroundColor: color.hex }}
            />
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <X className="size-3 text-white" aria-hidden="true" />
            </div>
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <div className="flex min-w-0 gap-1.5">
        {colors.map((color) => (
          <span
            key={color.token}
            className="max-w-[6.5rem] truncate text-[11px] text-subdued"
            title={getSelectionReferenceLabel(color)}
          >
            {getSelectionReferenceLabel(color)}
          </span>
        ))}
      </div>
    </div>
  );
};

const LibrarySwatchButton = ({
  color,
  disabled,
  selected,
  onToggle,
  style,
  onMouseEnter,
  onMouseLeave,
}: {
  color: PantoneIndexedColor;
  disabled: boolean;
  selected: boolean;
  onToggle: (color: PantoneIndexedColor) => void;
  style?: CSSProperties;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) => (
  <button
    type="button"
    onClick={() => onToggle(color)}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    disabled={disabled}
    title={`${color.label} · ${color.hex.toUpperCase()}`}
    className={cx(
      "relative aspect-square w-full rounded-lg transition-transform duration-100 ease-out outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
      selected && "z-10 ring-2 ring-primary ring-offset-1",
      disabled && "cursor-not-allowed opacity-40",
    )}
    style={{ ...style, backgroundColor: color.hex }}
  >
    {selected ? (
      <span className="flex size-full items-center justify-center">
        <Check className="size-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
      </span>
    ) : null}
  </button>
);

const LibrarySwatchGrid = ({
  colors,
  selectedHexes,
  atLimit,
  onToggle,
}: {
  colors: readonly PantoneIndexedColor[];
  selectedHexes: ReadonlySet<string>;
  atLimit: boolean;
  onToggle: (color: PantoneIndexedColor) => void;
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getStyle = (index: number): CSSProperties | undefined => {
    if (hoveredIndex === null) {
      return undefined;
    }
    if (index === hoveredIndex) {
      return { transform: "scale(1.1)", zIndex: 10 };
    }
    const row = Math.floor(index / LIBRARY_GRID_COLUMNS);
    const column = index % LIBRARY_GRID_COLUMNS;
    const hoveredRow = Math.floor(hoveredIndex / LIBRARY_GRID_COLUMNS);
    const hoveredColumn = hoveredIndex % LIBRARY_GRID_COLUMNS;
    const isNeighbor =
      (row === hoveredRow && Math.abs(column - hoveredColumn) === 1) ||
      (column === hoveredColumn && Math.abs(row - hoveredRow) === 1);
    if (isNeighbor) {
      return { transform: "scale(1.05)", zIndex: 5 };
    }
    return undefined;
  };

  return (
    <div className="grid grid-cols-7">
      {colors.map((color, index) => {
        const isSelected = selectedHexes.has(color.hex);
        return (
          <LibrarySwatchButton
            key={color.id}
            color={color}
            disabled={atLimit && !isSelected}
            selected={isSelected}
            onToggle={onToggle}
            style={getStyle(index)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        );
      })}
    </div>
  );
};

const sampleCanvasColor = (
  event: MouseEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
): string | null => {
  const context = canvas.getContext("2d");
  if (context === null) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  const x = Math.max(
    0,
    Math.min(
      canvas.width - 1,
      Math.floor((event.clientX - rect.left) * (canvas.width / rect.width)),
    ),
  );
  const y = Math.max(
    0,
    Math.min(
      canvas.height - 1,
      Math.floor((event.clientY - rect.top) * (canvas.height / rect.height)),
    ),
  );
  const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
  return rgbToHex([red ?? 0, green ?? 0, blue ?? 0]);
};

export function InspirationColorPicker({
  open,
  selectedColors,
  onColorsChange,
}: InspirationColorPickerProps) {
  const [tab, setTab] = useState<"library" | "image">("library");
  const [colors, setColors] = useState<readonly PantoneIndexedColor[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hoveredHex, setHoveredHex] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || colors !== null || isLoading || loadError !== null) {
      return;
    }
    let active = true;
    const loadColors = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const nextColors = await loadPantoneCatalog();
        if (active) {
          setColors(nextColors);
          setLoadError(null);
        }
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : "Unable to load Pantone colors.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadColors();
    return () => {
      active = false;
    };
  }, [colors, isLoading, loadError, open]);

  useEffect(() => {
    if (imageUrl === null) {
      return;
    }
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const context = canvas.getContext("2d");
    if (context === null) {
      return;
    }
    const image = new Image();
    image.onload = () => {
      const maxWidth = canvas.parentElement?.clientWidth ?? 420;
      const scale = Math.min(maxWidth / image.width, 320 / image.height, 1);
      canvas.width = Math.max(1, Math.floor(image.width * scale));
      canvas.height = Math.max(1, Math.floor(image.height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = imageUrl;
    return () => {
      URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const selectedHexes = useMemo(
    () => new Set(selectedColors.map((color) => color.hex)),
    [selectedColors],
  );
  const atLimit = selectedColors.length >= MAX_CREATE_INSPIRATION_COLORS;

  const removeByToken = (token: string): void => {
    onColorsChange(selectedColors.filter((color) => color.token !== token));
  };

  const removeByHex = (hex: string): void => {
    onColorsChange(selectedColors.filter((color) => color.hex !== hex));
  };

  const togglePantone = (color: PantoneIndexedColor): void => {
    if (selectedHexes.has(color.hex)) {
      removeByHex(color.hex);
      return;
    }
    if (atLimit) {
      return;
    }
    onColorsChange([...selectedColors, buildPantoneSelection(color)]);
  };

  const addSampledColor = (hex: string): void => {
    const selection = buildSampledSelection(hex);
    if (selection === null || selectedHexes.has(selection.hex) || atLimit) {
      return;
    }
    onColorsChange([...selectedColors, selection]);
  };

  const searchState = useMemo(() => {
    if (colors === null) {
      return { mode: "text" as const, results: [] as PantoneIndexedColor[] };
    }
    return searchPantones(colors, deferredQuery, null);
  }, [colors, deferredQuery]);

  const groupedResults = useMemo(
    () =>
      deferredQuery.trim().length === 0 ? groupPantonesByFamily(searchState.results) : [],
    [deferredQuery, searchState.results],
  );

  return (
    <div className="flex h-[25rem] min-h-0 flex-col overflow-hidden bg-card">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-card-border px-3">
          <div className="flex h-11 w-full gap-5">
            <button
              type="button"
              onClick={() => setTab("library")}
              className={cx(
                "min-h-11 border-none bg-transparent px-1 pb-2 pt-2 text-[15px] tracking-wide text-subdued cursor-pointer relative",
                tab === "library" &&
                  "font-semibold text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gold",
              )}
            >
              Library
            </button>
            <button
              type="button"
              onClick={() => setTab("image")}
              className={cx(
                "min-h-11 border-none bg-transparent px-1 pb-2 pt-2 text-[15px] tracking-wide text-subdued cursor-pointer relative",
                tab === "image" &&
                  "font-semibold text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gold",
              )}
            >
              From Image
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "library" ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="px-4 pb-3 pt-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subdued/50" />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search colors, Pantones, #"
                    disabled={isLoading}
                    className={cx(
                      "w-full rounded-full border border-card-border bg-page/80 py-2 pl-8 pr-8 text-sm text-primary outline-none focus:ring-1 focus:ring-gold/50 placeholder:text-subdued/40",
                      isLoading && "cursor-not-allowed opacity-60",
                    )}
                  />
                  {query.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-subdued/50 transition-colors hover:text-primary"
                      aria-label="Clear color search"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
                {loadError ? (
                  <div className="rounded-xl border border-card-border bg-page px-4 py-8 text-center">
                    <div className="text-sm font-semibold text-warning">
                      Unable to load Pantone colors.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLoadError(null);
                        setColors(null);
                      }}
                      className="mt-3 h-8 rounded-full border border-card-border bg-card px-4 text-sm font-medium text-primary cursor-pointer hover:bg-page"
                    >
                      Try again
                    </button>
                  </div>
                ) : isLoading ? (
                  <div className="rounded-xl border border-card-border bg-page/60 px-4 py-10 text-center text-sm text-subdued">
                    Loading Pantone colors…
                  </div>
                ) : searchState.results.length === 0 ? (
                  <div className="rounded-xl border border-card-border bg-page/60 px-4 py-10 text-center text-sm text-subdued">
                    No Pantone colors match your search.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {deferredQuery.trim().length > 0 ? (
                      <div>
                        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-subdued/70">
                          {searchState.mode === "color" ? "Closest matches" : "Results"}
                        </p>
                        <LibrarySwatchGrid
                          colors={searchState.results}
                          selectedHexes={selectedHexes}
                          atLimit={atLimit}
                          onToggle={togglePantone}
                        />
                      </div>
                    ) : (
                      groupedResults.map((group) => (
                        <div key={group.family}>
                          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-subdued/70">
                            {group.family}
                          </p>
                          <LibrarySwatchGrid
                            colors={group.colors}
                            selectedHexes={selectedHexes}
                            atLimit={atLimit}
                            onToggle={togglePantone}
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto overscroll-contain px-4 py-3">
              <div className="flex min-h-0 flex-col gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptedImageTypes}
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) {
                      return;
                    }
                    setHoveredHex(null);
                    setCursorPos(null);
                    setImageUrl(URL.createObjectURL(file));
                  }}
                />

                {imageUrl === null ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-card-border-hover bg-page/50 px-5 text-center transition-colors hover:bg-surface-muted/80"
                  >
                    <div className="flex size-9 items-center justify-center rounded-full border border-card-border bg-card text-subdued">
                      <ImagePlus className="size-4" aria-hidden="true" />
                    </div>
                    <div className="text-base font-semibold text-primary">
                      Upload an image to sample colors
                    </div>
                    <div className="max-w-xs text-sm text-subdued">
                      Click anywhere on the image to add an exact sampled color.
                    </div>
                  </button>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <div className="relative overflow-hidden rounded-xl border border-card-border bg-page/50 p-2">
                      <canvas
                        ref={canvasRef}
                        onMouseLeave={() => {
                          setHoveredHex(null);
                          setCursorPos(null);
                        }}
                        onMouseMove={(event) => {
                          const canvas = canvasRef.current;
                          if (canvas === null) {
                            return;
                          }
                          const sampledHex = sampleCanvasColor(event, canvas);
                          if (sampledHex === null) {
                            return;
                          }
                          const rect = canvas.getBoundingClientRect();
                          setHoveredHex(sampledHex);
                          setCursorPos({
                            x: event.clientX - rect.left,
                            y: event.clientY - rect.top,
                          });
                        }}
                        onClick={(event) => {
                          const canvas = canvasRef.current;
                          if (canvas === null) {
                            return;
                          }
                          const sampledHex = sampleCanvasColor(event, canvas);
                          if (sampledHex !== null) {
                            addSampledColor(sampledHex);
                          }
                        }}
                        className={cx(
                          "max-h-[20rem] w-full rounded-lg object-contain",
                          atLimit ? "cursor-not-allowed" : "cursor-crosshair",
                        )}
                      />

                      {hoveredHex && cursorPos ? (
                        <div
                          className="pointer-events-none absolute z-10"
                          style={{
                            top: Math.max(12, cursorPos.y - 44),
                            left: Math.min(
                              cursorPos.x + 12,
                              Math.max(
                                12,
                                (canvasRef.current?.clientWidth ?? 180) - 132,
                              ),
                            ),
                          }}
                        >
                          <div className="flex items-center gap-2 rounded-lg border border-card-border bg-card/95 px-2.5 py-2 shadow-dropdown">
                            <span
                              aria-hidden="true"
                              className="size-4 rounded-full border border-card-border/70"
                              style={{ backgroundColor: hoveredHex }}
                            />
                            <span className="text-xs font-medium text-primary">
                              {hoveredHex.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-xl border border-card-border bg-page/40 px-3 py-2.5">
                      <p className="text-[11px] text-subdued">
                        Image-picked colors stay exact and are not snapped to Pantone.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setHoveredHex(null);
                          setCursorPos(null);
                          setImageUrl(null);
                        }}
                        className="h-8 shrink-0 rounded-full border-none bg-transparent px-3 text-sm font-medium text-primary cursor-pointer hover:bg-surface-muted/80"
                      >
                        Change image
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <SelectedColorsBar colors={selectedColors} onRemove={removeByToken} />
    </div>
  );
}
