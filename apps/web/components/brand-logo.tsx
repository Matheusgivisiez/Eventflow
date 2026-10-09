import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  iconOnly?: boolean;
  inverted?: boolean;
};

// O "E" é sempre a mesma arte em qualquer tema; só o texto muda de cor.
const WORDMARK_MASK: CSSProperties = {
  WebkitMaskImage: "url(/images/eventflow-wordmark.png)",
  maskImage: "url(/images/eventflow-wordmark.png)",
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat"
};

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/images/eventflow-mark.png"
      alt="Event Flow"
      width={300}
      height={300}
      className={cn("h-9 w-9 object-contain", className)}
    />
  );
}

export function BrandLogo({ className, markClassName, iconOnly = false, inverted = false }: BrandLogoProps) {
  if (iconOnly) return <BrandMark className={cn("h-6 w-6", markClassName, className)} />;

  // Proporções medidas na arte original (1143 x 412).
  return (
    <span role="img" aria-label="Event Flow" className={cn("relative block aspect-[1143/412] h-9 shrink-0", className)}>
      <Image
        src="/images/eventflow-mark.png"
        alt=""
        width={300}
        height={300}
        priority
        className={cn("absolute left-0 top-0 h-full w-auto", markClassName)}
      />
      <span
        aria-hidden
        style={WORDMARK_MASK}
        className={cn(
          "absolute bottom-0 right-0 h-[97.82%] w-[59.58%]",
          inverted ? "bg-white" : "bg-[#010424] dark:bg-white"
        )}
      />
    </span>
  );
}
