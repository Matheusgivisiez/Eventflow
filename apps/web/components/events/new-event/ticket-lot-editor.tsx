"use client";

import { CalendarDays, ChevronDown, ChevronUp, Ticket } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Field } from "@/components/events/new-event/form-primitives";
import { Input } from "@/components/ui/input";
import { formatScheduleValue, joinScheduleValue, splitScheduleValue, type ScheduleValue } from "@/lib/new-event-schedule";
import { calculatePercentagePrice, formatBRL, parseCurrencyInput } from "@/lib/ticket-pricing";
import { closingRuleFromOptions, closingRuleOptions, type TicketClosingRule } from "@/lib/ticket-lot-rules";

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
  const closingRule = (values.closingRule ?? "DATE") as TicketClosingRule;
  const closingOptions = closingRuleOptions(closingRule);
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
      {previousPrice !== undefined && <div className="space-y-3 rounded-lg border bg-muted/30 p-3"><div className="text-sm font-medium">Como definir o preço?</div><select aria-label="Modo de preço do lote" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={priceMode} onChange={(event) => onChange("priceMode", event.target.value)}><option value="FIXED">Preço fixo</option><option value="PERCENTAGE">Percentual sobre o lote anterior</option></select>{priceMode === "PERCENTAGE" ? <><Field label="Acréscimo sobre o lote anterior" error={errors.priceAdjustmentPercent}><PercentageInput value={values.priceAdjustmentPercent ?? 0} onChange={(value) => onChange("priceAdjustmentPercent", value)} /></Field><p className="text-sm text-muted-foreground">Lote anterior: <strong>{formatBRL(previousPrice)}</strong> → Preço calculado: <strong className="text-foreground">{calculatedPrice === undefined ? "Informe o percentual" : formatBRL(calculatedPrice)}</strong></p></> : <Field label="Preço (R$)" error={errors.price}><CurrencyInput value={values.price ?? 0} onChange={(value) => onChange("price", value)} /></Field>}</div>}
      <div className="grid gap-4 sm:grid-cols-3">
        {previousPrice === undefined && <Field label="Preço (R$)" error={errors.price}><CurrencyInput value={values.price ?? 0} onChange={(value) => onChange("price", value)} /></Field>}
        <Field label="Quantidade total" error={errors.quantity}><Input type="number" min="1" step="1" value={values.quantity ?? 0} onChange={(event) => onChange("quantity", Number(event.target.value))} /></Field>
        <Field label="Limite por compra" error={errors.limitPerBuy}><Input type="number" min="1" step="1" value={values.limitPerBuy ?? 0} onChange={(event) => onChange("limitPerBuy", Number(event.target.value))} /></Field>
      </div>
      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" /> Quando o lote deve encerrar?</div>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Critérios para encerrar o lote</legend>
          <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition " + (closingOptions.byDate ? "border-primary/50 bg-primary/10" : "bg-background hover:border-primary/30")}>
            <input type="checkbox" checked={closingOptions.byDate} onChange={(event) => { if (event.target.checked || closingOptions.bySold) onChange("closingRule", closingRuleFromOptions(event.target.checked, closingOptions.bySold)); }} className="mt-1 h-4 w-4 accent-primary" />
            <span><strong className="block text-sm">Por data</strong><span className="text-xs text-muted-foreground">Encerra em um dia e horário.</span></span>
          </label>
          <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition " + (closingOptions.bySold ? "border-primary/50 bg-primary/10" : "bg-background hover:border-primary/30")}>
            <input type="checkbox" checked={closingOptions.bySold} onChange={(event) => { if (event.target.checked || closingOptions.byDate) onChange("closingRule", closingRuleFromOptions(closingOptions.byDate, event.target.checked)); }} className="mt-1 h-4 w-4 accent-primary" />
            <span><strong className="block text-sm">Por vendas</strong><span className="text-xs text-muted-foreground">Encerra ao atingir um limite.</span></span>
          </label>
        </fieldset>
        {closingOptions.byDate && <DateTimeField label="Vendas terminam" value={end} optional onChange={(next) => changeSchedule("endsAt", next)} />}
        {closingOptions.bySold && <Field label="Encerrar ao vender (ingressos)" error={errors.salesEndQuantity}><Input type="number" min="1" step="1" value={values.salesEndQuantity ?? ""} onChange={(event) => onChange("salesEndQuantity", Number(event.target.value))} /></Field>}
        <p className="text-xs text-muted-foreground">{closingOptions.byDate && closingOptions.bySold ? "O primeiro critério atingido encerra este lote para novas compras." : closingOptions.byDate ? "O lote ficará disponível até a data e horário definidos." : "O lote ficará disponível até atingir a quantidade de vendas definida."}</p>
      </div>
      <div className="rounded-lg bg-muted/60 p-3 text-sm"><span className="text-muted-foreground">Resumo:</span> {values.quantity || 0} ingressos por <strong>{Number(values.price || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>, máximo de {values.limitPerBuy || 0} por compra.{values.startsAt && <span className="mt-1 block text-xs text-muted-foreground">Disponível a partir de {formatScheduleValue(values.startsAt)}.</span>}</div>
    </section>
  );
}

function CurrencyInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(formatBRL(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatBRL(value));
  }, [focused, value]);

  function adjust(delta: number) {
    onChange(Math.max(0, Math.round((value + delta) * 100) / 100));
  }

  return <div className="relative">
    <span className="pointer-events-none absolute left-3 top-2.5 text-sm font-semibold text-primary">R$</span>
    <Input aria-label="Preço em reais" inputMode="decimal" value={draft} className="pr-20 pl-10" onFocus={(event) => { setFocused(true); event.currentTarget.select(); }} onChange={(event) => { setDraft(event.target.value); onChange(parseCurrencyInput(event.target.value)); }} onBlur={() => { setFocused(false); setDraft(formatBRL(value)); }} />
    <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
      <StepButton label="Diminuir preço em um real" onClick={() => adjust(-1)}><ChevronDown className="h-3.5 w-3.5" /></StepButton>
      <StepButton label="Aumentar preço em um real" onClick={() => adjust(1)}><ChevronUp className="h-3.5 w-3.5" /></StepButton>
    </div>
  </div>;
}

function PercentageInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="relative">
    <Input aria-label="Acréscimo percentual" type="number" min="0" step="1" value={value} className="pr-20" onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} />
    <span className="pointer-events-none absolute right-10 top-2.5 text-sm font-semibold text-primary">%</span>
    <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
      <StepButton label="Diminuir percentual" onClick={() => onChange(Math.max(0, value - 1))}><ChevronDown className="h-3.5 w-3.5" /></StepButton>
      <StepButton label="Aumentar percentual" onClick={() => onChange(value + 1)}><ChevronUp className="h-3.5 w-3.5" /></StepButton>
    </div>
  </div>;
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-label={label} onClick={onClick} className="rounded p-1 text-muted-foreground transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{children}</button>;
}

function DateTimeField({ label, value, optional, onChange }: { label: string; value: ScheduleValue; optional?: boolean; onChange: (value: Partial<ScheduleValue>) => void }) {
  return <div className="space-y-2"><div className="flex items-center justify-between"><span className="text-xs font-medium">{label}</span>{optional && <span className="text-xs text-muted-foreground">Opcional</span>}</div><div className="grid gap-2 sm:grid-cols-[1fr_110px]"><Input aria-label={`${label}: data`} type="date" value={value.date} onChange={(event) => onChange({ date: event.target.value })} /><Input aria-label={`${label}: horário`} type="time" value={value.time} onChange={(event) => onChange({ time: event.target.value })} /></div></div>;
}
