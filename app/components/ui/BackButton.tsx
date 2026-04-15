import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  onClick: () => void;
  children?: React.ReactNode;
}

export function BackButton({
  onClick,
  children = "Back to Categories",
}: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer text-gold text-sm font-medium font-sans"
    >
      <ArrowLeft className="size-4" />
      {children}
    </button>
  );
}
