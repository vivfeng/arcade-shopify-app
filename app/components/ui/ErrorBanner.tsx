import { AlertCircle } from "lucide-react";

interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4">
      <AlertCircle className="size-5 text-red-800 shrink-0 mt-0.5" />
      <p className="m-0 text-sm leading-relaxed text-red-800">{message}</p>
    </div>
  );
}
