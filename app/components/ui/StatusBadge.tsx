interface StatusBadgeProps {
  label: string;
  bg: string;
  fg: string;
}

export function StatusBadge({ label, bg, fg }: StatusBadgeProps) {
  return (
    <span
      className="inline-flex items-center h-[18px] px-[7px] rounded-full text-[10px] font-medium whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}
