"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Ticket, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";

type PublicOrderDetails = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  eventAddress?: string;
  buyerName: string;
  buyerEmail: string;
  totalCents: number;
  status: "PENDING" | "PAID" | "CANCELED" | "REFUNDED";
  paymentMethod?: string;
  createdAt: string;
  items: Array<{
    ticketTypeName: string;
    quantity: number;
    totalCents: number;
  }>;
  tickets: Array<{
    uuid: string;
    attendeeName: string;
    qrCodeDataUrl?: string;
    status: string;
  }>;
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["public-order", orderId],
    queryFn: () => api<PublicOrderDetails>(`/checkout/order/${orderId}`, { auth: false }),
    enabled: Boolean(orderId),
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 4000 : false)
  });

  if (!orderId) {
    return (
      <Card className="max-w-md w-full">
        <CardHeader>
          <AlertCircle className="h-10 w-10 text-destructive" />
          <CardTitle>Pedido não informado</CardTitle>
          <CardDescription>Não foi possível encontrar a referência do pedido.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/eventos">Explorar Eventos</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full max-w-lg" />;
  }

  if (error || !order) {
    return (
      <Card className="max-w-md w-full">
        <CardHeader>
          <AlertCircle className="h-10 w-10 text-destructive" />
          <CardTitle>Pedido não encontrado</CardTitle>
          <CardDescription>Verifique se a URL está correta ou entre em contato com o suporte.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/eventos">Voltar aos Eventos</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isPaid = order.status === "PAID";
  const isPending = order.status === "PENDING";

  return (
    <div className="max-w-xl w-full space-y-6">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-2">
            {isPaid && <CheckCircle2 className="h-8 w-8 text-green-600" />}
            {isPending && <Clock className="h-8 w-8 text-amber-500 animate-pulse" />}
            {!isPaid && !isPending && <AlertCircle className="h-8 w-8 text-destructive" />}
          </div>
          <CardTitle className="text-2xl">
            {isPaid ? "Pagamento Confirmado!" : isPending ? "Processando Pagamento..." : "Pedido " + order.status}
          </CardTitle>
          <CardDescription>
            {isPaid
              ? `Obrigado, ${order.buyerName}! Seus ingressos estão prontos.`
              : isPending
              ? "Estamos aguardando a confirmação do gateway. Esta página será atualizada automaticamente."
              : "Este pedido foi cancelado ou reembolsado."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/40 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Evento</span>
              <span className="font-semibold">{order.eventTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Código do Pedido</span>
              <span className="font-mono text-xs">{order.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Comprador</span>
              <span>{order.buyerName} ({order.buyerEmail})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Pago</span>
              <span className="font-semibold">{money(order.totalCents)}</span>
            </div>
          </div>

          {/* Ingressos Emitidos */}
          {isPaid && order.tickets.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                Seus Ingressos ({order.tickets.length})
              </h3>
              <div className="grid gap-3">
                {order.tickets.map((t) => (
                  <div key={t.uuid} className="rounded-lg border p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-card">
                    <div className="space-y-1 text-center sm:text-left">
                      <p className="font-medium text-sm">{t.attendeeName}</p>
                      <p className="text-xs text-muted-foreground font-mono">ID: {t.uuid}</p>
                    </div>
                    {t.qrCodeDataUrl && (
                      <img src={t.qrCodeDataUrl} alt="QR Code Ingresso" className="h-24 w-24 rounded border p-1 bg-white" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 flex flex-col gap-2">
            <Button asChild variant="outline" className="w-full gap-2">
              <Link href="/eventos">
                <ArrowLeft className="h-4 w-4" />
                Voltar aos Eventos
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Suspense fallback={<Skeleton className="h-[450px] w-full max-w-xl" />}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}
