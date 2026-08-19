import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, label, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    return (
      <div className="input-wrapper">
        <input
          id={inputId}
          ref={ref}
          placeholder=" "
          className={cn(
            "input-floating flex h-14 w-full rounded-xl border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
            className
          )}
          {...props}
        />
        <label htmlFor={inputId} className="floating-label font-medium">
          {label}
        </label>
      </div>
    );
  }
);
FloatingInput.displayName = "FloatingInput";
