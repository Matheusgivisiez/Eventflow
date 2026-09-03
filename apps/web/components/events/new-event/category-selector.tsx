"use client";

import { Tag } from "lucide-react";
import { Field } from "@/components/events/new-event/form-primitives";
import { Input } from "@/components/ui/input";
import { EVENT_CATEGORIES, OTHER_CATEGORY } from "@/lib/event-category";

export function CategorySelector({
  value,
  otherValue,
  error,
  otherError,
  onChange,
  onOtherChange
}: {
  value?: string;
  otherValue?: string;
  error?: string;
  otherError?: string;
  onChange: (value: string) => void;
  onOtherChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Tag className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-semibold">Categoria do evento</h2>
          <p className="text-sm text-muted-foreground">Escolha a categoria que melhor ajuda o público a encontrar seu evento.</p>
        </div>
      </div>

      <Field label="Categoria" error={error}>
        <select
          aria-label="Categoria do evento"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Selecione uma categoria</option>
          {EVENT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          <option value={OTHER_CATEGORY}>Outro</option>
        </select>
      </Field>

      {value === OTHER_CATEGORY && (
        <Field label="Qual é o tipo do evento?" error={otherError}>
          <Input
            aria-label="Categoria personalizada"
            placeholder="Ex.: Feira gastronômica"
            value={otherValue ?? ""}
            onChange={(event) => onOtherChange(event.target.value)}
          />
        </Field>
      )}
    </div>
  );
}

