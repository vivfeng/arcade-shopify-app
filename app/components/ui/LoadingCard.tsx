import { Spinner } from "./Spinner";

interface LoadingCardProps {
  title: string;
  subtitle?: string;
}

export function LoadingCard({ title, subtitle }: LoadingCardProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-card-border bg-card p-10 shadow-card">
      <Spinner />
      <p className="m-0 text-[15px] font-semibold text-primary">{title}</p>
      {subtitle && (
        <p className="m-0 text-[13px] text-subdued">{subtitle}</p>
      )}
    </div>
  );
}
