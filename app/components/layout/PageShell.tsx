import { BackButton } from "../ui/BackButton";

interface PageShellProps {
  heading: string;
  subtitle?: string;
  backLabel?: string;
  onBack?: () => void;
  maxWidth?: number;
  children: React.ReactNode;
}

export function PageShell({
  heading,
  subtitle,
  backLabel,
  onBack,
  maxWidth,
  children,
}: PageShellProps) {
  return (
    <div
      className="flex flex-col gap-3.5"
      style={maxWidth ? { maxWidth } : undefined}
    >
      {onBack && (
        <BackButton onClick={onBack}>{backLabel ?? "Back"}</BackButton>
      )}

      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[26px] font-bold text-primary tracking-tight leading-[28.6px]">
          {heading}
        </h1>
        {subtitle && <p className="m-0 text-sm text-subdued">{subtitle}</p>}
      </div>

      {children}
    </div>
  );
}
