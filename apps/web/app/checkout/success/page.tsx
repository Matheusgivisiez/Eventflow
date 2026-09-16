"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Ticket,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  LogIn,
  Mail,
  MailWarning,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthHydration } from "@/hooks/use-auth-hydration";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

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
  /** Delivery state of the confirmation e-mail. Absent on older API versions. */
  confirmationEmailStatus?: "PENDING" | "SENT" | "FAILED" | "SKIPPED" | null;
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [storedCheckout, setStoredCheckout] = useState<{
    orderId: string;
    accessToken: string;
  } | null>(null);
  const orderId = searchParams.get("orderId") ?? storedCheckout?.orderId;
  const accessToken =
    searchParams.get("accessToken") ?? storedCheckout?.accessToken;
  const infinitePaySlug =
    searchParams.get("invoice_slug") ?? searchParams.get("slug");
  const infinitePayTransactionNsu = searchParams.get("transaction_nsu");
  const isSimulatedPayment = searchParams.get("status") === "paid";
  // A guest has no session: sending them to /me/ingressos only bounces them
  // to the login screen and loses the ticket they just paid for.
  const hasHydratedAuth = useAuthHydration();
  const sessionAccessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = hasHydratedAuth && Boolean(sessionAccessToken);
  const [simulationRequested, setSimulationRequested] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const stored = window.localStorage.getItem("eventflow:last-checkout");
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as {
        orderId?: string;
        accessToken?: string;
        createdAt?: number;
      };
      const isRecent =
        !parsed.createdAt ||
        Date.now() - parsed.createdAt < 1000 * 60 * 60 * 24;
      if (parsed.orderId && parsed.accessToken && isRecent) {
        setStoredCheckout({
          orderId: parsed.orderId,
          accessToken: parsed.accessToken,
        });
      }
    } catch {
      window.localStorage.removeItem("eventflow:last-checkout");
    }
  }, []);

  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["public-order", orderId, accessToken, infinitePaySlug, infinitePayTransactionNsu],
    queryFn: () => {
      const params = new URLSearchParams({
        accessToken: accessToken ?? "",
      });
      if (infinitePaySlug) params.set("slug", infinitePaySlug);
      if (infinitePayTransactionNsu) params.set("transaction_nsu", infinitePayTransactionNsu);
      return api<PublicOrderDetails>(
        `/checkout/order/${orderId}?${params.toString()}`,
        { auth: false },
      );
    },
    enabled: Boolean(orderId && accessToken),
    refetchInterval: (query) =>
      query.state.data?.status === "PENDING" ? 4000 : false,
  });

  useEffect(() => {
    if (!isSimulatedPayment || simulationRequested || !orderId || !accessToken || order?.status !== "PENDING") {
      return;
    }

    setSimulationRequested(true);
    void api(
      `/checkout/order/${orderId}/confirm-simulation?accessToken=${encodeURIComponent(accessToken)}`,
      { method: "POST", auth: false },
    )
      .then(() => queryClient.invalidateQueries({ queryKey: ["public-order", orderId, accessToken] }))
      .catch(() => setSimulationRequested(false));
  }, [accessToken, isSimulatedPayment, order?.status, orderId, queryClient, simulationRequested]);

  const isPaid = order?.status === "PAID";
  const isPending = order?.status === "PENDING";
  // Only "SENT" means a message actually left the server. PENDING, FAILED,
  // SKIPPED (no SMTP) and undefined all mean the buyer may have nothing.
  const emailDelivered = order?.confirmationEmailStatus === "SENT";
  // The URL alone is enough to come back here, so the localStorage backup is
  // only expendable once the link is reproducible or the e-mail really went out.
  const linkIsRecoverable =
    Boolean(searchParams.get("orderId") && searchParams.get("accessToken")) || emailDelivered;

  useEffect(() => {
    if (!isPaid || !hasHydratedAuth) return;

    if (linkIsRecoverable) {
      window.localStorage.removeItem("eventflow:last-checkout");
    }
    void queryClient.invalidateQueries({ queryKey: ["my-tickets"] });

    if (!isAuthenticated) {
      // Guests stay here: this page and the e-mailed link are their ticket.
      return;
    }

    setRedirectCountdown(3);
    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          router.push("/me/ingressos");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [hasHydratedAuth, isAuthenticated, isPaid, linkIsRecoverable, queryClient, router]);

  if (!orderId || !accessToken) {
    return (
      <Card className="max-w-md w-full">
        <CardHeader>
          <AlertCircle className="h-10 w-10 text-destructive" />
          <CardTitle>Pedido não informado</CardTitle>
          <CardDescription>
            Não foi possível validar o acesso seguro a este pedido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/">Explorar Eventos</Link>
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
          <CardDescription>
            Verifique se a URL está correta ou entre em contato com o suporte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/me/ingressos">Ir para Meus Ingressos</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-xl w-full space-y-6">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-2">
            {isPaid && <CheckCircle2 className="h-8 w-8 text-green-600" />}
            {isPending && (
              <Clock className="h-8 w-8 text-amber-500 animate-pulse" />
            )}
            {!isPaid && !isPending && (
              <AlertCircle className="h-8 w-8 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isPaid
              ? "Pagamento Confirmado!"
              : isPending
                ? "Processando Pagamento..."
                : "Pedido " + order.status}
          </CardTitle>
          <CardDescription>
            {isPaid
              ? `Obrigado, ${order.buyerName}! Seu ingresso foi gerado.`
              : isPending
                ? "Estamos aguardando a confirmação do gateway. Esta página será atualizada automaticamente."
                : "Este pedido foi cancelado ou reembolsado."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPaid && hasHydratedAuth && !isAuthenticated && (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              {emailDelivered ? (
                <div className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-purple" />
                  <div className="text-sm">
                    <p className="font-medium">Enviamos este link para {order.buyerEmail}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Guarde o e-mail: ele é pessoal e dá acesso a este pedido sem precisar de conta.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="text-sm">
                    <p className="font-medium">Salve o endereço desta página agora</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Ainda não confirmamos o envio do e-mail para {order.buyerEmail}. Este endereço é
                      a sua via de acesso ao ingresso — guarde nos favoritos ou crie uma conta abaixo.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="flex-1 gap-2">
                  <Link href={`/register?email=${encodeURIComponent(order.buyerEmail)}`}>
                    <UserPlus className="h-4 w-4" />
                    Criar conta
                  </Link>
                </Button>
                <Button asChild variant="outline" className="flex-1 gap-2">
                  <Link href="/login">
                    <LogIn className="h-4 w-4" />
                    Já tenho conta
                  </Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Com uma conta confirmada você reúne todas as suas compras em Meus Ingressos.
              </p>
            </div>
          )}

          {isPaid && isAuthenticated && redirectCountdown !== null && (
            <div className="rounded-lg border border-brand-purple/20 bg-brand-purple/10 p-3 text-center text-sm font-medium text-brand-purple flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>
                Redirecionando para Meus Ingressos em {redirectCountdown}s...
              </span>
            </div>
          )}

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
              <span>
                {order.buyerName} ({order.buyerEmail})
              </span>
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
                  <div
                    key={t.uuid}
                    className="rounded-lg border p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-card"
                  >
                    <div className="space-y-1 text-center sm:text-left">
                      <p className="font-medium text-sm">{t.attendeeName}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        ID: {t.uuid}
                      </p>
                    </div>
                    {t.qrCodeDataUrl && (
                      <Image
                        src={t.qrCodeDataUrl}
                        alt="QR Code Ingresso"
                        width={96}
                        height={96}
                        unoptimized
                        className="h-24 w-24 rounded border bg-white p-1"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 flex flex-col sm:flex-row gap-2">
            {isAuthenticated ? (
              <Button asChild className="flex-1 gap-2">
                <Link href="/me/ingressos">
                  Ir para Meus Ingressos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : hasHydratedAuth ? (
              <Button asChild variant="outline" className="flex-1 gap-2">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                  Explorar eventos
                </Link>
              </Button>
            ) : null}
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
