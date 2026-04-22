import type { ReactNode } from "react";
import { TitleBar } from "@shopify/app-bridge-react";

type AppPageWidth = "default" | "narrow" | "full";

interface AppPageProps {
  children: ReactNode;
  title?: string;
  width?: AppPageWidth;
  className?: string;
}

const WIDTH_CLASSES: Record<AppPageWidth, string> = {
  default: "max-w-[998px]",
  narrow: "max-w-[662px]",
  full: "max-w-none",
};

export function AppPage({
  children,
  title,
  width = "default",
  className = "",
}: AppPageProps) {
  const innerClass = [
    "mx-auto w-full",
    WIDTH_CLASSES[width],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {title && <TitleBar title={title} />}
      <div className="w-full px-4 py-4 sm:px-6 sm:py-5 bg-page">
        <div className={innerClass}>{children}</div>
      </div>
    </>
  );
}
