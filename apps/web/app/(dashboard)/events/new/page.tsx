"use client";

import type React from "react";
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
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const schema = z.object({
  title: z.string().min(3, "Informe o nome do evento."),
  description: z.string().min(20, "Descreva melhor o evento."),
  category: z.string().min(2, "Informe a categoria."),
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
      feePayer: "BUYER",
      allowTicketTransfer: true,
      transferLockHours: 24,
      qrCodeReleaseMinutesBeforeStart: 60
    }
  });

  const format = form.watch("format");
  const zipCode = form.watch("zipCode");
  const allowTicketTransfer = form.watch("allowTicketTransfer");
  const { ref: numberFormRef, ...numberField } = form.register("number");

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
          category: data.category,
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
            limitPerBuy: data.firstTicketLimitPerBuy
          }
        })
      });
    },
    onSuccess: (event) => router.push(`/events/${event.id}/tickets`)
  });

  async function nextStep() {
    const fieldsByStep: Record<Step, (keyof FormData)[]> = {
      0: format === "IN_PERSON"
        ? ["title", "description", "category", "startsAt", "endsAt", "zipCode", "city", "state", "address", "number"]
        : ["title", "description", "category", "startsAt", "endsAt", "onlineUrl"],
      1: ["firstTicketName", "firstTicketPrice", "firstTicketQuantity", "firstTicketLimitPerBuy"],
      2: ["feePayer", "allowTicketTransfer", "transferLockHours", "qrCodeReleaseMinutesBeforeStart"]
    };
    const valid = await form.trigger(fieldsByStep[step]);
    if (valid) setStep((current) => Math.min(current + 1, 2) as Step);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Novo evento</h1>
          <p className="text-sm text-muted-foreground">Crie a pagina, o primeiro lote e as regras de venda no mesmo fluxo.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-card p-1">
          {steps.map((item, index) => {
            const Icon = item.icon;
            const active = step === index;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => setStep(index as Step)}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form className="grid gap-6 lg:grid-cols-[1fr_360px]" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
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
                  <Field label="Categoria" error={form.formState.errors.category?.message}>
                    <Input {...form.register("category")} />
                  </Field>
                  <Field label="Formato">
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register("format")}>
                      <option value="IN_PERSON">Presencial</option>
                      <option value="ONLINE">Online</option>
                    </select>
                  </Field>
                </div>
                <Field label="Banner" error={form.formState.errors.bannerUrl?.message}>
                  <ImageUpload value={form.watch("bannerUrl")} onChange={(url) => form.setValue("bannerUrl", url)} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Inicio" error={form.formState.errors.startsAt?.message}>
                    <Input type="datetime-local" {...form.register("startsAt")} />
                  </Field>
                  <Field label="Fim" error={form.formState.errors.endsAt?.message}>
                    <Input type="datetime-local" {...form.register("endsAt")} />
                  </Field>
                </div>
                {format === "ONLINE" ? (
                  <Field label="Link online" error={form.formState.errors.onlineUrl?.message}>
                    <Input placeholder="https://meet.google.com/..." {...form.register("onlineUrl")} />
                  </Field>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="CEP" error={form.formState.errors.zipCode?.message}>
                      <Input
                        placeholder="00000-000"
                        {...form.register("zipCode")}
                        onChange={(event) => {
                          const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
                          const masked = digits.replace(/^(\d{5})(\d)/, "$1-$2");
                          form.setValue("zipCode", masked, { shouldValidate: true });
                        }}
                      />
                      {cepStatus === "loading" && <p className="text-xs text-muted-foreground">Buscando endereco...</p>}
                      {cepStatus === "error" && <p className="text-xs text-destructive">CEP nao encontrado.</p>}
                    </Field>
                    <Field label="Numero" error={form.formState.errors.number?.message}>
                      <Input {...numberField} ref={(element) => { numberFormRef(element); numberRef.current = element; }} />
                    </Field>
                    <Field label="Endereco" error={form.formState.errors.address?.message}>
                      <Input {...form.register("address")} />
                    </Field>
                    <Field label="Bairro">
                      <Input {...form.register("neighborhood")} />
                    </Field>
                    <Field label="Cidade" error={form.formState.errors.city?.message}>
                      <Input {...form.register("city")} />
                    </Field>
                    <Field label="Estado" error={form.formState.errors.state?.message}>
                      <Input maxLength={2} {...form.register("state")} />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Google Maps">
                        <Input {...form.register("mapUrl")} />
                      </Field>
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                  O primeiro lote e obrigatorio para evitar evento publicado sem ingressos no checkout.
                </div>
                <Field label="Nome do lote" error={form.formState.errors.firstTicketName?.message}>
                  <Input {...form.register("firstTicketName")} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Preco (R$)" error={form.formState.errors.firstTicketPrice?.message}>
                    <Input type="number" min="0" step="0.01" {...form.register("firstTicketPrice")} />
                  </Field>
                  <Field label="Quantidade" error={form.formState.errors.firstTicketQuantity?.message}>
                    <Input type="number" min="1" {...form.register("firstTicketQuantity", { valueAsNumber: true })} />
                  </Field>
                  <Field label="Limite por compra" error={form.formState.errors.firstTicketLimitPerBuy?.message}>
                    <Input type="number" min="1" {...form.register("firstTicketLimitPerBuy", { valueAsNumber: true })} />
                  </Field>
                </div>
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
              <Summary icon={<Ticket className="h-4 w-4" />} label="Lote" value={`${form.watch("firstTicketQuantity") || 0} ingressos`} />
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      <span className="max-w-40 truncate font-medium">{value}</span>
    </div>
  );
}
