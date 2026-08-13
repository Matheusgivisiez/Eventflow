"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
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

type CheckoutResponse = {
  id: string;
  orderId: string;
  status: string;
  totalCents: number;
  checkoutUrl?: string;
};

const buyerSchema = z.object({
  buyerName: z.string().min(2, "Informe seu nome."),
  buyerEmail: z.string().email("Informe um e-mail valido."),
  buyerDocument: z.string().optional(),
  buyerPhone: z.string().optional(),
  paymentMethod: z.enum(["PIX", "CREDIT_CARD"])
});

/** Parse items from query string: "id1:qty1,id2:qty2" */
function parseItemsParam(raw: string | null): Record<string, number> {
  if (!raw) return {};
  const result: Record<string, number> = {};

  for (const pair of raw.split(",")) {
    const [id, qtyStr] = pair.split(":");
    if (id && qtyStr) {
      const qty = parseInt(qtyStr, 10);
      if (!isNaN(qty) && qty > 0) {
        result[id] = qty;
      }
    }
  }

  return result;
}

function CheckoutForm() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const initialItems = useMemo(() => parseItemsParam(searchParams.get("items")), [searchParams]);

  const [quantities, setQuantities] = useState<Record<string, number>>(initialItems);

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
      api<CheckoutResponse>(`/checkout/${slug}`, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          items: Object.entries(quantities)
            .filter(([, quantity]) => quantity > 0)
            .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }))
        }),
        auth: false
      }),
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      }
    }
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
            <CardDescription>Seu pagamento esta pendente. A confirmacao emitira seus QR Codes automaticamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Pedido: {mutation.data.orderId ?? mutation.data.id}</p>
            <p>Total: {money(mutation.data.totalCents)}</p>
            {mutation.data.checkoutUrl && (
              <Button asChild className="w-full gap-2">
                <a href={mutation.data.checkoutUrl}>
                  <ExternalLink className="h-4 w-4" />
                  Abrir checkout seguro
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5">
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <Link href={`/eventos/${slug}`}>
              <ArrowLeft className="h-4 w-4" />
              Voltar ao evento
            </Link>
          </Button>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            Checkout seguro
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_380px]">
        <form className="space-y-6" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Checkout</h1>
            <p className="text-sm text-muted-foreground">{event?.title}</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Seus ingressos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {event?.ticketTypes.map((ticket) => {
                const qty = quantities[ticket.id] ?? 0;
                if (qty <= 0) return null;
                return (
                  <div key={ticket.id} className="flex items-center justify-between gap-4 rounded-xl border p-4">
                    <div>
                      <p className="font-medium">{ticket.name}</p>
                      <p className="text-sm text-muted-foreground">{money(ticket.priceCents)} × {qty}</p>
                    </div>
                    <Input
                      className="w-20 text-center"
                      type="number"
                      min={0}
                      max={ticket.limitPerBuy}
                      value={qty}
                      onChange={(e) => setQuantities((state) => ({ ...state, [ticket.id]: Number(e.target.value) }))}
                    />
                  </div>
                );
              })}
              {Object.values(quantities).every((q) => q <= 0) && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhum ingresso selecionado.{" "}
                  <Link href={`/eventos/${slug}`} className="text-primary hover:underline">
                    Voltar ao evento
                  </Link>
                </p>
              )}
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
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register("paymentMethod")}>
                  <option value="PIX">PIX</option>
                  <option value="CREDIT_CARD">Cartao</option>
                </select>
              </Field>
            </CardContent>
          </Card>
        </form>
        <Card className="h-fit sticky top-20">
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
            <CardDescription>Revise os valores antes de confirmar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Summary label="Subtotal" value={money(subtotal)} />
            <Summary label="Taxas" value={money(fee)} />
            <Summary label="Total" value={money(subtotal + fee)} strong />
            {mutation.error && (
              <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{mutation.error.message}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={mutation.isPending}
                  onClick={form.handleSubmit((data) => mutation.mutate(data))}
                >
                  Tentar novamente
                </Button>
              </div>
            )}
            <Button className="w-full" disabled={mutation.isPending || subtotal === 0} onClick={form.handleSubmit((data) => mutation.mutate(data))}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mutation.isPending ? "Criando checkout..." : "Confirmar compra"}
            </Button>
          </CardContent>
        </Card>
      </div>
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

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background p-6 flex justify-center">
        <Skeleton className="h-[620px] w-full max-w-6xl" />
      </div>
    }>
      <CheckoutForm />
    </Suspense>
  );
}
