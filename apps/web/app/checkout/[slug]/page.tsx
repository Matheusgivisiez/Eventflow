"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";
import type { EventHubEvent, PaymentMethod } from "@/types/eventhub";

const buyerSchema = z.object({
  buyerName: z.string().min(2, "Informe seu nome."),
  buyerEmail: z.string().email("Informe um e-mail valido."),
  buyerDocument: z.string().optional(),
  buyerPhone: z.string().optional(),
  paymentMethod: z.enum(["PIX", "CREDIT_CARD"])
});

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { data: event, isLoading } = useQuery({
    queryKey: ["checkout-event", slug],
    queryFn: () => api<EventHubEvent>(`/events/public/${slug}`, { auth: false })
  });
  const form = useForm<z.infer<typeof buyerSchema>>({
    resolver: zodResolver(buyerSchema),
    defaultValues: { paymentMethod: "PIX" }
  });
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof buyerSchema>) =>
      api<any>(`/checkout/${slug}`, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          items: Object.entries(quantities)
            .filter(([, quantity]) => quantity > 0)
            .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }))
        }),
        auth: false
      })
  });

  const subtotal = useMemo(() => {
    return event?.ticketTypes.reduce((sum, ticket) => sum + (quantities[ticket.id] ?? 0) * ticket.priceCents, 0) ?? 0;
  }, [event, quantities]);
  const fee = Math.round(subtotal * 0.08);

  if (isLoading) return <Skeleton className="m-6 h-[620px]" />;

  if (mutation.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <CardTitle>Pedido criado</CardTitle>
            <CardDescription>Seu pagamento foi registrado como pendente. A confirmacao emitira seus QR Codes automaticamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Pedido: {mutation.data.id}</p>
            <p>Total: {money(mutation.data.totalCents)}</p>
            {mutation.data.payment?.qrCodePayload && <p className="rounded-md bg-muted p-3">PIX: {mutation.data.payment.qrCodePayload}</p>}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_380px]">
      <form className="space-y-6" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Checkout</h1>
          <p className="text-sm text-muted-foreground">{event?.title}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Escolha seus ingressos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {event?.ticketTypes.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div>
                  <p className="font-medium">{ticket.name}</p>
                  <p className="text-sm text-muted-foreground">{money(ticket.priceCents)} · {ticket.quantity - ticket.sold} disponiveis</p>
                </div>
                <Input
                  className="w-24"
                  type="number"
                  min={0}
                  max={ticket.limitPerBuy}
                  value={quantities[ticket.id] ?? 0}
                  onChange={(event) => setQuantities((state) => ({ ...state, [ticket.id]: Number(event.target.value) }))}
                />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" error={form.formState.errors.buyerName?.message}>
              <Input {...form.register("buyerName")} />
            </Field>
            <Field label="E-mail" error={form.formState.errors.buyerEmail?.message}>
              <Input type="email" {...form.register("buyerEmail")} />
            </Field>
            <Field label="Documento">
              <Input {...form.register("buyerDocument")} />
            </Field>
            <Field label="Telefone">
              <Input {...form.register("buyerPhone")} />
            </Field>
            <Field label="Pagamento">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" {...form.register("paymentMethod")}>
                <option value="PIX">PIX</option>
                <option value="CREDIT_CARD">Cartao</option>
              </select>
            </Field>
          </CardContent>
        </Card>
      </form>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
          <CardDescription>Revise os valores antes de confirmar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Summary label="Subtotal" value={money(subtotal)} />
          <Summary label="Taxas" value={money(fee)} />
          <Summary label="Total" value={money(subtotal + fee)} strong />
          {mutation.error && <p className="text-sm text-destructive">{mutation.error.message}</p>}
          <Button className="w-full" disabled={mutation.isPending || subtotal === 0} onClick={form.handleSubmit((data) => mutation.mutate(data))}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar compra
          </Button>
        </CardContent>
      </Card>
    </main>
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

function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-lg font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
