import React, { useId } from "react";
import { Label } from "@/components/ui/label";

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? fieldId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : undefined
      })
    : children;

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      {control}
      {error && <p id={errorId} className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}

export function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      <span className="max-w-40 truncate font-medium">{value}</span>
    </div>
  );
}
