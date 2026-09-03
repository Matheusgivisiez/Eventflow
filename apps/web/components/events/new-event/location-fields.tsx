"use client";

import type { RefObject } from "react";
import { Check, Loader2, MapPin, SearchX } from "lucide-react";
import { Field } from "@/components/events/new-event/form-primitives";
import { Input } from "@/components/ui/input";

type LocationErrors = Partial<Record<"zipCode" | "number" | "address" | "city" | "state", string>>;

export function LocationFields({
  values,
  errors,
  cepStatus,
  numberRef,
  onChange
}: {
  values: { zipCode?: string; number?: string; address?: string; neighborhood?: string; city?: string; state?: string; mapUrl?: string };
  errors: LocationErrors;
  cepStatus: "idle" | "loading" | "error";
  numberRef: RefObject<HTMLInputElement | null>;
  onChange: (field: keyof typeof values, value: string) => void;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="location-heading">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <MapPin className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 id="location-heading" className="font-semibold">Onde acontece?</h2>
          <p className="text-sm text-muted-foreground">Digite o CEP para preencher o endereço automaticamente. Você pode revisar qualquer campo.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
        <Field label="CEP" error={errors.zipCode}>
          <div className="relative">
            <Input
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              value={values.zipCode ?? ""}
              onChange={(event) => onChange("zipCode", event.target.value)}
              aria-describedby="cep-status"
            />
            {cepStatus === "loading" && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" aria-label="Buscando endereço" />}
            {cepStatus === "idle" && values.zipCode?.replace(/\D/g, "").length === 8 && <Check className="absolute right-3 top-3 h-4 w-4 text-emerald-600" aria-label="CEP localizado" />}
            {cepStatus === "error" && <SearchX className="absolute right-3 top-3 h-4 w-4 text-destructive" aria-label="CEP não localizado" />}
          </div>
          <p id="cep-status" className={`text-xs ${cepStatus === "error" ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">
            {cepStatus === "loading" ? "Buscando endereço..." : cepStatus === "error" ? "Não encontramos esse CEP. Confira ou preencha o endereço manualmente." : "O endereço será preenchido automaticamente quando o CEP estiver completo."}
          </p>
        </Field>
        <Field label="Número" error={errors.number}>
          <Input ref={numberRef} autoComplete="street-address" value={values.number ?? ""} onChange={(event) => onChange("number", event.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Endereço" error={errors.address}>
          <Input autoComplete="street-address" value={values.address ?? ""} onChange={(event) => onChange("address", event.target.value)} />
        </Field>
        <Field label="Bairro">
          <Input autoComplete="address-level3" value={values.neighborhood ?? ""} onChange={(event) => onChange("neighborhood", event.target.value)} />
        </Field>
        <Field label="Cidade" error={errors.city}>
          <Input autoComplete="address-level2" value={values.city ?? ""} onChange={(event) => onChange("city", event.target.value)} />
        </Field>
        <Field label="Estado" error={errors.state}>
          <Input maxLength={2} autoComplete="address-level1" value={values.state ?? ""} onChange={(event) => onChange("state", event.target.value.toUpperCase())} />
        </Field>
      </div>

      <Field label="Link do Google Maps">
        <Input placeholder="https://maps.google.com/..." value={values.mapUrl ?? ""} onChange={(event) => onChange("mapUrl", event.target.value)} />
      </Field>
    </section>
  );
}

