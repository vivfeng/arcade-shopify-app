import { useState } from "react";

export function ChipDropdown({
    icon,
    label,
    value,
    options,
    onSelect,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string | null;
    options: string[];
    onSelect: (val: string) => void;
  }) {
    const [open, setOpen] = useState(false);
  
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 h-9 min-h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold shadow-[0_1px_0_rgba(15,15,15,0.04)] cursor-pointer transition-[background-color,border-color,color,box-shadow] ${
          value
            ? "bg-gold-pale border-gold-border text-gold-dark"
            : "border-card-border bg-card/90 text-primary hover:border-card-border-hover"
        }`}
        onClick={() => setOpen(!open)}
      >
        {icon}
        {value || label}
      </button>
      {open && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[180px] rounded-lg border border-card-border bg-card py-1.5 shadow-dropdown z-[120]">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`block w-full px-3.5 py-2 border-none text-left cursor-pointer text-[13px] text-primary hover:bg-page ${
                  opt === value ? "font-semibold bg-page" : "bg-transparent font-normal"
                }`}
                onClick={() => {
                  onSelect(opt);
                  setOpen(false);
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