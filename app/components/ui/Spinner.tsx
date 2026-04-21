export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`size-8 rounded-full border-3 border-surface-muted border-t-gold animate-spin ${className}`}
    />
  );
}
