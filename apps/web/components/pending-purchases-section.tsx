"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Clock3, RefreshCw, Ticket } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/utils";

const enabled = process.env.NEXT_PUBLIC_PENDING_PURCHASES_ENABLED === "true";

type PendingOrder = {
  id: string;
  event: { title: string; slug: string; startsAt: string; bannerUrl?: string | null };
  items: { name: string; quantity: number }[];
  totalCents: number;
  reservedUntil: string;
};

function remainingLabel(iso: string, now: number) {
  const seconds = Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function PendingPurchasesSection({ userId }: { userId?: string }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [resumeError, setResumeError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !userId) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [userId]);

  const orders = useQuery({
    queryKey: ["pending-purchases", userId],
    queryFn: () => api<PendingOrder[]>("/buyer/pending-orders"),
    enabled: enabled && Boolean(userId),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true
  });
  const resume = useMutation({
    mutationFn: (id: string) => api<{ checkoutUrl: string }>(`/checkout/order/${id}/resume`, {
      method: "POST", body: JSON.stringify({})
    }),
    onSuccess: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
    onError: (error) => {
      setResumeError(error instanceof Error ? error.message : "Não foi possível retomar este pagamento.");
      void queryClient.invalidateQueries({ queryKey: ["pending-purchases", userId] });
    }
  });

  if (!enabled || !userId || (!orders.isError && !orders.data?.length)) return null;

  return (
    <section aria-labelledby="pending-purchases-title" className="mb-8">
      <div className="mb-4 flex items-end justify-between gap-4 px-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Pagamento</p>
          <h2 id="pending-purchases-title" className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Compras em andamento</h2>
        </div>
        {orders.data?.length ? <span className="rounded-full border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">{orders.data.length} pendente{orders.data.length === 1 ? "" : "s"}</span> : null}
      </div>
      {orders.isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4">
          <p className="text-sm">Não foi possível consultar suas compras em andamento.</p>
          <Button type="button" variant="outline" onClick={() => void orders.refetch()} className="min-h-11 gap-2"><RefreshCw className="h-4 w-4" /> Tentar novamente</Button>
        </div>
      ) : null}
      {resumeError ? <p role="alert" className="mb-3 rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm">{resumeError}</p> : null}
      <div className="space-y-3">
        {orders.data?.map((order) => {
          const active = new Date(order.reservedUntil).getTime() > now;
          return (
            <article key={order.id} className="overflow-hidden rounded-[24px] border border-primary/25 bg-card shadow-sm">
              <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">Aguardando pagamento</span>
                    <span className="text-muted-foreground">Pedido {order.id.slice(-8).toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold leading-tight sm:text-xl">{order.event.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(" · ")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="font-semibold">{money(order.totalCents)}</span>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Clock3 className="h-4 w-4" aria-hidden="true" /> Reserva até {new Date(order.reservedUntil).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:w-52">
                  {active ? (
                    <Button type="button" className="min-h-11 w-full gap-2 rounded-xl" disabled={resume.isPending} onClick={() => { setResumeError(null); resume.mutate(order.id); }}>
                      <Ticket className="h-4 w-4" aria-hidden="true" /> Continuar pagamento <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="min-h-11 w-full rounded-xl"><Link href={`/eventos/${order.event.slug}`}>Ver ingressos disponíveis</Link></Button>
                  )}
                  <p className="text-center text-xs text-muted-foreground" aria-live="off">{active ? `Reserva por mais ${remainingLabel(order.reservedUntil, now)}` : "Reserva encerrada"}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
