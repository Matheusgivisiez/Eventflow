import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  iconOnly?: boolean;
  inverted?: boolean;
};

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={cn("h-9 w-9", className)} viewBox="0 0 64 54" fill="none" role="img" aria-label="Event Flow">
      <path d="M9 10.5C13.2 5.7 18.8 3.5 26.2 3.5H56C54.9 11.1 49.5 16.5 41.8 16.5H21.4C16.8 16.5 12.7 18 9 21.2V10.5Z" fill="#1769E8" />
      <path d="M9 25.2C13.2 20.7 18.9 18.6 26.2 18.6H50.8C49.6 25.6 44.5 30.6 37.3 30.6H21.4C16.8 30.6 12.7 32.1 9 35.3V25.2Z" fill="#1769E8" />
      <path d="M9 39C13.2 34.6 18.9 32.6 26.2 32.6H55.2C54.1 40.2 48.7 45.8 40.9 45.8H21.4C16.8 45.8 12.7 47.2 9 50.5V39Z" fill="#1769E8" />
    </svg>
  );
}

export function BrandLogo({ className, markClassName, textClassName, iconOnly = false, inverted = false }: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark className={markClassName} />
      {!iconOnly && (
        <div className={cn("leading-[0.86] tracking-normal", inverted ? "text-white" : "text-brand-deep dark:text-white", textClassName)}>
          <span className="text-[1.2rem] font-bold tracking-[-0.02em]">Event Flow</span>
        </div>
      )}
    </div>
  );
}
