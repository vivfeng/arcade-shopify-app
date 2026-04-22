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
      <div className="relative">
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-2xl border cursor-pointer text-[13px] font-medium transition-colors ${
            value
              ? "bg-gold-pale border-gold-border text-gold-dark"
              : "bg-card border-card-border text-primary"
          }`}
          onClick={() => setOpen(!open)}
        >
          {icon}
          {value || label}
        </button>
        {open && (
          <div className="absolute top-[calc(100%+4px)] left-0 min-w-[180px] rounded-lg border border-card-border bg-card py-1.5 shadow-dropdown z-10">
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