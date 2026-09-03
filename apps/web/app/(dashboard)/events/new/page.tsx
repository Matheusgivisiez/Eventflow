"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CalendarClock, Loader2, MapPin, Radio, Save, ShieldCheck, Ticket } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/image-upload";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { SchedulePicker } from "@/components/events/new-event/schedule-picker";
import { StepNavigation } from "@/components/events/new-event/step-navigation";
import { Field, Summary } from "@/components/events/new-event/form-primitives";
import { CategorySelector } from "@/components/events/new-event/category-selector";
import { resolveEventCategory } from "@/lib/event-category";
import { LocationFields } from "@/components/events/new-event/location-fields";
import { formatCep } from "@/lib/cep";
import { formatScheduleValue } from "@/lib/new-event-schedule";
import { TicketLotEditor } from "@/components/events/new-event/ticket-lot-editor";
import { AdditionalTicketLots } from "@/components/events/new-event/additional-ticket-lots";

const schema = z.object({
  title: z.string().min(3, "Informe o nome do evento."),
  description: z.string().min(20, "Descreva melhor o evento."),
  category: z.string().min(2, "Informe a categoria."),
  categoryOther: z.string().optional(),
  startsAt: z.string().min(1, "Informe data e horario."),
  endsAt: z.string().optional(),
  bannerUrl: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  number: z.string().optional(),
  mapUrl: z.string().optional(),
  onlineUrl: z.string().optional(),
  format: z.enum(["ONLINE", "IN_PERSON"]),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  firstTicketName: z.string().min(2, "Informe o nome do lote."),
  firstTicketPrice: z.coerce.number().min(0, "Informe um preco valido."),
  firstTicketQuantity: z.coerce.number().int().min(1, "Informe ao menos 1 ingresso."),
  firstTicketLimitPerBuy: z.coerce.number().int().min(1, "Informe um limite valido."),
  firstTicketStartsAt: z.string().optional(),
  firstTicketEndsAt: z.string().optional(),
  firstTicketClosingRule: z.enum(["DATE", "SOLD", "BOTH"]).default("DATE"),
  firstTicketSalesEndQuantity: z.coerce.number().int().min(1, "Informe uma quantidade valida.").optional(),
  firstTicketPriceMode: z.enum(["FIXED", "PERCENTAGE"]).default("FIXED"),
  firstTicketPriceAdjustmentPercent: z.coerce.number().min(0).optional(),
  additionalTicketLots: z.array(z.object({
    name: z.string().min(2, "Informe o nome do lote."),
    price: z.coerce.number().min(0, "Informe um preco valido."),
    quantity: z.coerce.number().int().min(1, "Informe ao menos 1 ingresso."),
    limitPerBuy: z.coerce.number().int().min(1, "Informe um limite valido."),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    closingRule: z.enum(["DATE", "SOLD", "BOTH"]).default("DATE"),
    salesEndQuantity: z.coerce.number().int().min(1, "Informe uma quantidade valida.").optional(),
    priceMode: z.enum(["FIXED", "PERCENTAGE"]).default("FIXED"),
    priceAdjustmentPercent: z.coerce.number().min(0).optional()
  })).default([]),
  feePayer: z.enum(["BUYER", "ORGANIZER"]),
  allowTicketTransfer: z.boolean(),
  transferLockHours: z.coerce.number().int().min(0),
  qrCodeReleaseMinutesBeforeStart: z.coerce.number().int().min(0)
}).superRefine((data, ctx) => {
  const startsAt = data.startsAt ? new Date(data.startsAt) : undefined;
  const endsAt = data.endsAt ? new Date(data.endsAt) : undefined;

  if (startsAt && startsAt <= new Date()) {
    ctx.addIssue({ code: "custom", path: ["startsAt"], message: "A data de inicio deve ser futura." });
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "O fim deve ser posterior ao inicio." });
  }
  if (data.format === "IN_PERSON") {
    if (!data.zipCode || data.zipCode.replace(/\D/g, "").length !== 8) {
      ctx.addIssue({ code: "custom", path: ["zipCode"], message: "Informe um CEP valido." });
    }
    for (const field of ["city", "state", "address", "number"] as const) {
      if (!data[field]?.trim()) {
        ctx.addIssue({ code: "custom", path: [field], message: "Campo obrigatorio para evento presencial." });
      }
    }
  }
  if (data.format === "ONLINE" && !data.onlineUrl?.trim()) {
    ctx.addIssue({ code: "custom", path: ["onlineUrl"], message: "Informe o link da transmissao." });
  }
  if (data.category === "__OTHER__" && !data.categoryOther?.trim()) {
    ctx.addIssue({ code: "custom", path: ["categoryOther"], message: "Informe o tipo do evento." });
  }
  if (data.firstTicketClosingRule !== "DATE" && !data.firstTicketSalesEndQuantity) {
    ctx.addIssue({ code: "custom", path: ["firstTicketSalesEndQuantity"], message: "Informe a quantidade que encerra o lote." });
  }
  data.additionalTicketLots.forEach((lot, index) => {
    if (lot.closingRule !== "DATE" && !lot.salesEndQuantity) {
      ctx.addIssue({ code: "custom", path: ["additionalTicketLots", index, "salesEndQuantity"], message: "Informe a quantidade que encerra o lote." });
    }
    if (lot.priceMode === "PERCENTAGE" && lot.priceAdjustmentPercent === undefined) {
      ctx.addIssue({ code: "custom", path: ["additionalTicketLots", index, "priceAdjustmentPercent"], message: "Informe o percentual do lote." });
    }
  });
});

type FormData = z.infer<typeof schema>;
type CreatedEvent = { id: string };
type Step = 0 | 1 | 2;

const steps = [
  { title: "Dados e local", icon: MapPin },
  { title: "Lote inicial", icon: Ticket },
  { title: "Regras", icon: ShieldCheck }
] as const;

export default function NewEventPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error">("idle");
  const numberRef = useRef<HTMLInputElement | null>(null);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      format: "IN_PERSON",
      status: "DRAFT",
      firstTicketName: "Primeiro lote",
      firstTicketPrice: 0,
      firstTicketQuantity: 100,
      firstTicketLimitPerBuy: 5,
      firstTicketClosingRule: "DATE",
      firstTicketPriceMode: "FIXED",
      additionalTicketLots: [],
      feePayer: "BUYER",
      allowTicketTransfer: true,
      transferLockHours: 24,
      qrCodeReleaseMinutesBeforeStart: 60
    }
  });

  const format = form.watch("format");
  const zipCode = form.watch("zipCode");
  const allowTicketTransfer = form.watch("allowTicketTransfer");

  useEffect(() => {
    const cep = zipCode?.replace(/\D/g, "");
    if (format !== "IN_PERSON" || cep?.length !== 8) return;

    const controller = new AbortController();
    setCepStatus("loading");
    fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.erro) {
          setCepStatus("error");
          return;
        }
        form.setValue("address", data.logradouro ?? "", { shouldValidate: true });
        form.setValue("neighborhood", data.bairro ?? "");
        form.setValue("city", data.localidade ?? "", { shouldValidate: true });
        form.setValue("state", data.uf ?? "", { shouldValidate: true });
        setCepStatus("idle");
        numberRef.current?.focus();
      })
      .catch((error) => {
        if (error.name !== "AbortError") setCepStatus("error");
      });

    return () => controller.abort();
  }, [format, form, zipCode]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const startsAt = new Date(data.startsAt);
      const transferLockTime = data.allowTicketTransfer
        ? new Date(startsAt.getTime() - data.transferLockHours * 60 * 60 * 1000).toISOString()
        : undefined;
      const address = data.format === "IN_PERSON"
        ? [data.address, data.number, data.neighborhood].filter(Boolean).join(", ")
        : undefined;

      return api<CreatedEvent>("/events", {
        method: "POST",
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          category: resolveEventCategory(data.category, data.categoryOther),
          startsAt: startsAt.toISOString(),
          endsAt: data.endsAt ? new Date(data.endsAt).toISOString() : undefined,
          bannerUrl: data.bannerUrl || undefined,
          galleryUrls: [],
          city: data.format === "IN_PERSON" ? data.city : undefined,
          state: data.format === "IN_PERSON" ? data.state : undefined,
          zipCode: data.format === "IN_PERSON" ? data.zipCode?.replace(/\D/g, "") : undefined,
          address,
          mapUrl: data.mapUrl || undefined,
          onlineUrl: data.format === "ONLINE" ? data.onlineUrl : undefined,
          format: data.format,
          status: data.status,
          seoTitle: data.seoTitle || undefined,
          seoDescription: data.seoDescription || undefined,
          feeAbsorbedByOrganizer: data.feePayer === "ORGANIZER",
          allowTicketTransfer: data.allowTicketTransfer,
          ticketTransferLockTime: transferLockTime,
          qrCodeReleaseMinutesBeforeStart: data.qrCodeReleaseMinutesBeforeStart,
          firstTicket: {
            name: data.firstTicketName,
            priceCents: Math.round(data.firstTicketPrice * 100),
            quantity: data.firstTicketQuantity,
            limitPerBuy: data.firstTicketLimitPerBuy,
            startsAt: data.firstTicketStartsAt ? new Date(data.firstTicketStartsAt).toISOString() : undefined,
            endsAt: data.firstTicketEndsAt ? new Date(data.firstTicketEndsAt).toISOString() : undefined,
            salesEndQuantity: data.firstTicketClosingRule !== "DATE" ? data.firstTicketSalesEndQuantity : undefined
            ,priceMode: data.firstTicketPriceMode
            ,priceAdjustmentPercent: data.firstTicketPriceMode === "PERCENTAGE" ? data.firstTicketPriceAdjustmentPercent : undefined
          },
          additionalTicketTypes: data.additionalTicketLots.map((lot) => ({
            name: lot.name,
            priceCents: Math.round(lot.price * 100),
            quantity: lot.quantity,
            limitPerBuy: lot.limitPerBuy,
            startsAt: lot.startsAt ? new Date(lot.startsAt).toISOString() : undefined,
            endsAt: lot.endsAt ? new Date(lot.endsAt).toISOString() : undefined,
            salesEndQuantity: lot.closingRule !== "DATE" ? lot.salesEndQuantity : undefined
            ,priceMode: lot.priceMode
            ,priceAdjustmentPercent: lot.priceMode === "PERCENTAGE" ? lot.priceAdjustmentPercent : undefined
          }))
        })
      });
    },
    onSuccess: (event) => router.push(`/events/${event.id}/tickets`)
  });

  async function nextStep() {
    const fieldsByStep: Record<Step, (keyof FormData)[]> = {
      0: format === "IN_PERSON"
        ? ["title", "description", "category", "categoryOther", "startsAt", "endsAt", "zipCode", "city", "state", "address", "number"]
        : ["title", "description", "category", "categoryOther", "startsAt", "endsAt", "onlineUrl"],
      1: ["firstTicketName", "firstTicketPrice", "firstTicketQuantity", "firstTicketLimitPerBuy", "firstTicketStartsAt", "firstTicketEndsAt", "firstTicketClosingRule", "firstTicketSalesEndQuantity", "additionalTicketLots"],
      2: ["feePayer", "allowTicketTransfer", "transferLockHours", "qrCodeReleaseMinutesBeforeStart"]
    };
    const valid = await form.trigger(fieldsByStep[step]);
    if (valid) {
      setStep((current) => Math.min(current + 1, 2) as Step);
      return;
    }

    const firstInvalidField = fieldsByStep[step].find((field) => form.getFieldState(field).invalid);
    if (firstInvalidField) {
      form.setFocus(firstInvalidField);
      requestAnimationFrame(() => {
        const fieldName = String(firstInvalidField);
        const element = document.querySelector(`[name="${fieldName}"], [aria-label="${fieldName}"], [aria-label*="${fieldName}"]`) as HTMLElement | null;
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
        element?.focus();
      });
    }
  }

  function handleStepChange(targetStep: number) {
    if (targetStep <= step) {
      setStep(targetStep as Step);
      return;
    }
    void nextStep();
  }

  const additionalLots = form.watch("additionalTicketLots");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Novo evento</h1>
          <p className="text-sm text-muted-foreground">Crie a pagina, o primeiro lote e as regras de venda no mesmo fluxo.</p>
          <p className="mt-1 text-xs font-medium text-primary sm:hidden" aria-live="polite">Etapa {step + 1} de {steps.length}</p>
        </div>
        <StepNavigation steps={steps} currentStep={step} onStepChange={handleStepChange} />
      </div>

      <form className="new-event-form grid gap-6 lg:grid-cols-[1fr_360px]" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        <Card>
          <CardHeader>
            <CardTitle>{steps[step].title}</CardTitle>
            <CardDescription>{step === 0 ? "Dados publicos e localizacao." : step === 1 ? "O evento ja nasce com estoque para venda." : "Taxas, transferencia e liberacao do QR Code."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {step === 0 && (
              <>
                <Field label="Nome" error={form.formState.errors.title?.message}>
                  <Input {...form.register("title")} />
                </Field>
                <Field label="Descricao" error={form.formState.errors.description?.message}>
                  <textarea className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" {...form.register("description")} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <CategorySelector
                    value={form.watch("category")}
                    otherValue={form.watch("categoryOther")}
                    error={form.formState.errors.category?.message}
                    otherError={form.formState.errors.categoryOther?.message}
                    onChange={(value) => form.setValue("category", value, { shouldValidate: true })}
                    onOtherChange={(value) => form.setValue("categoryOther", value, { shouldValidate: true })}
                  />
                  <Field label="Formato">
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register("format")}>
                      <option value="IN_PERSON">Presencial</option>
                      <option value="ONLINE">Online</option>
                    </select>
                  </Field>
                </div>
                <Field label="Banner" error={form.formState.errors.bannerUrl?.message}>
                  <ImageUpload aspect={16 / 5} value={form.watch("bannerUrl")} onChange={(url) => form.setValue("bannerUrl", url)} />
                </Field>
                <SchedulePicker
                  startsAt={form.watch("startsAt")}
                  endsAt={form.watch("endsAt")}
                  startError={form.formState.errors.startsAt?.message}
                  endError={form.formState.errors.endsAt?.message}
                  onStartsAtChange={(value) => form.setValue("startsAt", value, { shouldValidate: true })}
                  onEndsAtChange={(value) => form.setValue("endsAt", value, { shouldValidate: true })}
                />
                {format === "ONLINE" ? (
                  <Field label="Link online" error={form.formState.errors.onlineUrl?.message}>
                    <Input placeholder="https://meet.google.com/..." {...form.register("onlineUrl")} />
                  </Field>
                ) : (
                  <LocationFields
                    values={{
                      zipCode: form.watch("zipCode"), number: form.watch("number"), address: form.watch("address"),
                      neighborhood: form.watch("neighborhood"), city: form.watch("city"), state: form.watch("state"), mapUrl: form.watch("mapUrl")
                    }}
                    errors={{
                      zipCode: form.formState.errors.zipCode?.message, number: form.formState.errors.number?.message,
                      address: form.formState.errors.address?.message, city: form.formState.errors.city?.message, state: form.formState.errors.state?.message
                    }}
                    cepStatus={cepStatus}
                    numberRef={numberRef}
                    onChange={(field, value) => form.setValue(field, field === "zipCode" ? formatCep(value) : value, { shouldValidate: true })}
                  />
                )}
              </>
            )}

            {step === 1 && (
              <>
                <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                  O primeiro lote e obrigatorio para evitar evento publicado sem ingressos no checkout.
                </div>
                <TicketLotEditor
                  values={{
                    name: form.watch("firstTicketName"), price: form.watch("firstTicketPrice"), quantity: form.watch("firstTicketQuantity"),
                    limitPerBuy: form.watch("firstTicketLimitPerBuy"), startsAt: form.watch("firstTicketStartsAt"), endsAt: form.watch("firstTicketEndsAt"),
                    closingRule: form.watch("firstTicketClosingRule"), salesEndQuantity: form.watch("firstTicketSalesEndQuantity"),
                    priceMode: form.watch("firstTicketPriceMode"), priceAdjustmentPercent: form.watch("firstTicketPriceAdjustmentPercent")
                  }}
                  errors={{
                    name: form.formState.errors.firstTicketName?.message, price: form.formState.errors.firstTicketPrice?.message,
                    quantity: form.formState.errors.firstTicketQuantity?.message, limitPerBuy: form.formState.errors.firstTicketLimitPerBuy?.message,
                    salesEndQuantity: form.formState.errors.firstTicketSalesEndQuantity?.message
                  }}
                  onChange={(field, value) => {
                    const formField = ({ name: "firstTicketName", price: "firstTicketPrice", quantity: "firstTicketQuantity", limitPerBuy: "firstTicketLimitPerBuy", startsAt: "firstTicketStartsAt", endsAt: "firstTicketEndsAt", closingRule: "firstTicketClosingRule", salesEndQuantity: "firstTicketSalesEndQuantity", priceMode: "firstTicketPriceMode", priceAdjustmentPercent: "firstTicketPriceAdjustmentPercent" } as const)[field];
                    form.setValue(formField, value as never, { shouldValidate: true });
                  }}
                />
                <AdditionalTicketLots
                  lots={form.watch("additionalTicketLots")}
                  basePrice={form.watch("firstTicketPrice")}
                  onChange={(lots) => form.setValue("additionalTicketLots", lots.map((lot) => ({
                    name: lot.name ?? "", price: lot.price ?? 0, quantity: lot.quantity ?? 0,
                    limitPerBuy: lot.limitPerBuy ?? 0, startsAt: lot.startsAt, endsAt: lot.endsAt, closingRule: lot.closingRule ?? "DATE", salesEndQuantity: lot.salesEndQuantity, priceMode: lot.priceMode ?? "FIXED", priceAdjustmentPercent: lot.priceAdjustmentPercent
                  })), { shouldValidate: true })}
                />
              </>
            )}

            {step === 2 && (
              <>
                <Field label="Quem paga a taxa de servico?">
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register("feePayer")}>
                    <option value="BUYER">Comprador</option>
                    <option value="ORGANIZER">Organizador absorve</option>
                  </select>
                </Field>
                <label className="flex min-h-14 items-center justify-between gap-4 rounded-lg border p-4 text-sm">
                  <span>
                    <span className="block font-medium">Permitir transferencia de ingresso</span>
                    <span className="text-muted-foreground">Bloqueie perto do evento para reduzir revenda e suporte.</span>
                  </span>
                  <input type="checkbox" className="h-5 w-5" {...form.register("allowTicketTransfer")} />
                </label>
                {allowTicketTransfer && (
                  <Field label="Bloquear transferencia quantas horas antes?" error={form.formState.errors.transferLockHours?.message}>
                    <Input type="number" min="0" {...form.register("transferLockHours", { valueAsNumber: true })} />
                  </Field>
                )}
                <Field label="Liberar QR Code">
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register("qrCodeReleaseMinutesBeforeStart", { valueAsNumber: true })}>
                    <option value={60}>1h antes do evento</option>
                    <option value={120}>2h antes do evento</option>
                    <option value={0}>No momento da compra</option>
                  </select>
                </Field>
                <Field label="Status inicial">
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register("status")}>
                    <option value="DRAFT">Rascunho</option>
                    <option value="PUBLISHED">Publicado</option>
                  </select>
                </Field>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Publicacao</CardTitle>
              <CardDescription>Revise o essencial antes de salvar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Summary icon={<CalendarClock className="h-4 w-4" />} label="Inicio" value={form.watch("startsAt") || "Nao informado"} />
              <Summary icon={format === "ONLINE" ? <Radio className="h-4 w-4" /> : <MapPin className="h-4 w-4" />} label="Formato" value={format === "ONLINE" ? "Online" : "Presencial"} />
              <Summary icon={<Ticket className="h-4 w-4" />} label="Lotes" value={`${1 + additionalLots.length} configurado${additionalLots.length === 0 ? "" : "s"}`} />
              <div className="space-y-1.5 rounded-md border bg-background p-3 text-xs">
                <p className="font-medium">Resumo dos lotes</p>
                <p className="flex justify-between gap-2"><span>{form.watch("firstTicketName") || "Primeiro lote"}</span><span>{Number(form.watch("firstTicketPrice") || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></p>
                {additionalLots.map((lot, index) => <p key={`${lot.name}-${index}`} className="flex justify-between gap-2 text-muted-foreground"><span>{lot.name || `Lote ${index + 2}`}</span><span>{lot.priceMode === "PERCENTAGE" ? `${lot.priceAdjustmentPercent || 0}% sobre anterior` : Number(lot.price || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></p>)}
              </div>
              <Summary icon={<CalendarClock className="h-4 w-4" />} label="Programação" value={formatScheduleValue(form.watch("startsAt"))} />
              <div className="flex gap-2 pt-3">
                {step > 0 && (
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep((current) => Math.max(current - 1, 0) as Step)}>
                    Voltar
                  </Button>
                )}
                {step < 2 ? (
                  <Button type="button" className="flex-1" onClick={nextStep}>
                    Continuar
                  </Button>
                ) : (
                  <Button className="flex-1" disabled={mutation.isPending}>
                    {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar
                  </Button>
                )}
              </div>
              {mutation.error && <p className="text-sm text-destructive">{mutation.error.message}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input placeholder="Titulo SEO" {...form.register("seoTitle")} />
              <Input placeholder="Descricao SEO" {...form.register("seoDescription")} />
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
