"use client";

import { CalendarDays, Ticket } from "lucide-react";
import { Field } from "@/components/events/new-event/form-primitives";
import { Input } from "@/components/ui/input";
import { formatScheduleValue, joinScheduleValue, splitScheduleValue, type ScheduleValue } from "@/lib/new-event-schedule";
import { calculatePercentagePrice } from "@/lib/ticket-pricing";

export type TicketLotValues = { name?: string; price?: number; quantity?: number; limitPerBuy?: number; startsAt?: string; endsAt?: string; salesEndQuantity?: number; closingRule?: "DATE" | "SOLD" | "BOTH"; priceMode?: "FIXED" | "PERCENTAGE"; priceAdjustmentPercent?: number };

export function TicketLotEditor({ values, errors, onChange, title = "Configure o primeiro lote", onRemove, previousPrice }: {
  values: TicketLotValues;
  errors: Partial<Record<keyof typeof values, string>>;
  onChange: (field: keyof typeof values, value: string | number) => void;
  title?: string;
  onRemove?: () => void;
  previousPrice?: number;
}) {
  const end = splitScheduleValue(values.endsAt);
  const closingRule = values.closingRule ?? "DATE";
  const priceMode = values.priceMode ?? "FIXED";
  const calculatedPrice = previousPrice !== undefined && values.priceAdjustmentPercent !== undefined
    ? calculatePercentagePrice(previousPrice, values.priceAdjustmentPercent)
    : undefined;

  function changeSchedule(field: "startsAt" | "endsAt", next: Partial<ScheduleValue>) {
    const current = splitScheduleValue(values[field]);
    onChange(field, joinScheduleValue({ ...current, ...next }));
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="ticket-lot-heading">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Ticket className="h-5 w-5" aria-hidden="true" /></div>
        <div className="flex-1"><h2 id="ticket-lot-heading" className="font-semibold">{title}</h2><p className="text-sm text-muted-foreground">Defina preço, estoque, limite por compra e quando este lote estará disponível.</p></div>
        {onRemove && <button type="button" className="text-xs font-medium text-destructive hover:underline" onClick={onRemove}>Remover</button>}
      </div>
      <Field label="Nome do lote" error={errors.name}><Input value={values.name ?? ""} onChange={(event) => onChange("name", event.target.value)} /></Field>
      {previousPrice !== undefined && <div className="space-y-3 rounded-lg border bg-muted/30 p-3"><div className="text-sm font-medium">Como definir o preço?</div><select aria-label="Modo de preço do lote" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={priceMode} onChange={(event) => onChange("priceMode", event.target.value)}><option value="FIXED">Preço fixo</option><option value="PERCENTAGE">Percentual sobre o lote anterior</option></select>{priceMode === "PERCENTAGE" ? <><Field label="Acréscimo sobre o lote anterior" error={errors.priceAdjustmentPercent}><div className="relative"><Input type="number" min="0" step="0.01" value={values.priceAdjustmentPercent ?? ""} onChange={(event) => onChange("priceAdjustmentPercent", Number(event.target.value))} /><span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span></div></Field><p className="text-sm text-muted-foreground">Lote anterior: <strong>{previousPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong> → Preço calculado: <strong className="text-foreground">{calculatedPrice === undefined ? "Informe o percentual" : calculatedPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></p></> : <Field label="Preço (R$)" error={errors.price}><Input type="number" min="0" step="0.01" value={values.price ?? 0} onChange={(event) => onChange("price", Number(event.target.value))} /></Field>}</div>}
      <div className="grid gap-4 sm:grid-cols-3">
        {previousPrice === undefined && <Field label="Preço (R$)" error={errors.price}><Input type="number" min="0" step="0.01" value={values.price ?? 0} onChange={(event) => onChange("price", Number(event.target.value))} /></Field>}
        <Field label="Quantidade total" error={errors.quantity}><Input type="number" min="1" step="1" value={values.quantity ?? 0} onChange={(event) => onChange("quantity", Number(event.target.value))} /></Field>
        <Field label="Limite por compra" error={errors.limitPerBuy}><Input type="number" min="1" step="1" value={values.limitPerBuy ?? 0} onChange={(event) => onChange("limitPerBuy", Number(event.target.value))} /></Field>
      </div>
      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" /> Quando o lote deve encerrar?</div>
        <select aria-label="Regra de encerramento do lote" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={closingRule} onChange={(event) => onChange("closingRule", event.target.value)}>
          <option value="DATE">Em uma data</option>
          <option value="SOLD">Ao vender uma quantidade</option>
          <option value="BOTH">Na primeira condição: data ou quantidade</option>
        </select>
        {closingRule !== "SOLD" && <DateTimeField label="Vendas terminam" value={end} optional onChange={(next) => changeSchedule("endsAt", next)} />}
        {closingRule !== "DATE" && <Field label="Encerrar ao vender (ingressos)" error={errors.salesEndQuantity}><Input type="number" min="1" step="1" value={values.salesEndQuantity ?? ""} onChange={(event) => onChange("salesEndQuantity", Number(event.target.value))} /></Field>}
        <p className="text-xs text-muted-foreground">A primeira condição atingida encerra este lote para novas compras.</p>
      </div>
      <div className="rounded-lg bg-muted/60 p-3 text-sm"><span className="text-muted-foreground">Resumo:</span> {values.quantity || 0} ingressos por <strong>{Number(values.price || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>, máximo de {values.limitPerBuy || 0} por compra.{values.startsAt && <span className="mt-1 block text-xs text-muted-foreground">Disponível a partir de {formatScheduleValue(values.startsAt)}.</span>}</div>
    </section>
  );
}

function DateTimeField({ label, value, optional, onChange }: { label: string; value: ScheduleValue; optional?: boolean; onChange: (value: Partial<ScheduleValue>) => void }) {
  return <div className="space-y-2"><div className="flex items-center justify-between"><span className="text-xs font-medium">{label}</span>{optional && <span className="text-xs text-muted-foreground">Opcional</span>}</div><div className="grid gap-2 sm:grid-cols-[1fr_110px]"><Input aria-label={`${label}: data`} type="date" value={value.date} onChange={(event) => onChange({ date: event.target.value })} /><Input aria-label={`${label}: horário`} type="time" value={value.time} onChange={(event) => onChange({ time: event.target.value })} /></div></div>;
}
