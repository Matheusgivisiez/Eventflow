"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar, Download, MapPin, RefreshCcw, Smartphone,
  Ticket, WalletCards, QrCode, CheckCircle2, XCircle, Clock
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dateTime } from "@/lib/utils";

type MyTicket = {
  id: string;
  uuid: string;
  status: "AVAILABLE" | "USED" | "CANCELED";
  qrCodeDataUrl?: string;
  event: {
    title: string;
    slug: string;
    startsAt: string;
    bannerUrl?: string;
    city?: string;
    state?: string;
    format?: string;
  };
  ticketType: {
    name: string;
  };
  order: {
    id: string;
    status: string;
  };
};

const statusConfig = {
  AVAILABLE: { label: "Disponível", icon: CheckCircle2, color: "text-brand-purple bg-brand-purple/10 border-brand-purple/20 dark:bg-brand-purple/20" },
  USED: { label: "Utilizado", icon: Clock, color: "text-brand-violet bg-brand-violet/10 border-brand-violet/20 dark:bg-brand-violet/20" },
  CANCELED: { label: "Cancelado", icon: XCircle, color: "text-brand-pink bg-brand-pink/10 border-brand-pink/20 dark:bg-brand-pink/20" },
};

export default function MyTicketsPage() {
  const [scope, setScope] = useState<"future" | "past">("future");
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

  const tickets = useQuery({
    queryKey: ["my-tickets", scope],
    queryFn: () => api<MyTicket[]>(`/buyer/tickets?scope=${scope}`)
  });

  const refund = useMutation({
    mutationFn: (ticketId: string) => api(`/buyer/tickets/${ticketId}/refund`, { method: "POST" }),
    onSuccess: () => tickets.refetch()
  });

  const wallet = useMutation({
    mutationFn: ({ ticketId, provider }: { ticketId: string; provider: "google" | "apple" }) =>
      api(`/buyer/tickets/${ticketId}/${provider}-wallet`)
  });

  async function downloadPdf(ticketId: string) {
    const response = await fetch(`${apiUrl}/buyer/tickets/${ticketId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `eventflow-ticket-${ticketId}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-[calc(100vh-64px)]">
      {/* Header laranja estilo IngressoLive */}
      <div className="hero-gradient py-10 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <span className="text-white font-bold text-base">{user?.name?.charAt(0).toUpperCase() ?? "U"}</span>
            </div>
            <div>
              <p className="text-white/80 text-sm">Olá,</p>
              <p className="text-white font-bold text-lg leading-tight">{user?.name ?? "Participante"}</p>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-4">Meus Ingressos</h1>
          <p className="text-white/80 text-sm mt-1">Acesse QR Codes, baixe PDF e gerencie seus ingressos</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 -mt-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setScope("future")}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-all border ${
              scope === "future"
                ? "bg-primary text-white border-primary shadow-md shadow-primary/25"
                : "bg-white dark:bg-card text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            Eventos futuros
          </button>
          <button
            onClick={() => setScope("past")}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-all border ${
              scope === "past"
                ? "bg-primary text-white border-primary shadow-md shadow-primary/25"
                : "bg-white dark:bg-card text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            Eventos passados
          </button>
        </div>

        {/* Lista de ingressos */}
        {tickets.isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border bg-white dark:bg-card overflow-hidden">
                <Skeleton className="h-32 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : tickets.data?.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white dark:bg-card py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Ticket className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Nenhum ingresso encontrado</h2>
            <p className="mt-2 text-muted-foreground text-sm max-w-xs">
              {scope === "future"
                ? "Você não tem ingressos para eventos futuros. Que tal explorar?"
                : "Nenhum evento passado encontrado."}
            </p>
            <Button asChild className="mt-6 bg-primary hover:bg-primary/90 text-white rounded-xl">
              <Link href="/">Explorar eventos</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pb-6">
            {tickets.data?.map((ticket) => {
              const cfg = statusConfig[ticket.status];
              const StatusIcon = cfg.icon;
              const isExpanded = expandedTicket === ticket.id;

              return (
                <div key={ticket.id} className="overflow-hidden rounded-2xl border bg-white dark:bg-card shadow-sm">
                  {/* Banner do evento */}
                  {ticket.event.bannerUrl && (
                    <div className="relative h-32 w-full">
                      <Image
                        src={ticket.event.bannerUrl}
                        alt={ticket.event.title}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-3 left-4">
                        <span className="rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-white border border-white/30">
                          {ticket.ticketType.name}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-4">
                    {/* Status + título */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        {!ticket.event.bannerUrl && (
                          <span className="mb-1 inline-block text-xs font-semibold uppercase tracking-wide text-primary">
                            {ticket.ticketType.name}
                          </span>
                        )}
                        <h3 className="font-bold text-base leading-snug">
                          <Link href={`/eventos/${ticket.event.slug}`} className="hover:text-primary transition-colors">
                            {ticket.event.title}
                          </Link>
                        </h3>
                      </div>
                      <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Infos */}
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 text-primary/75 shrink-0" />
                        {dateTime(ticket.event.startsAt)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary/75 shrink-0" />
                        {ticket.event.city ? `${ticket.event.city}, ${ticket.event.state}` : "Online"}
                      </div>
                    </div>

                    {/* QR Code — expandível */}
                    {ticket.status === "AVAILABLE" && ticket.qrCodeDataUrl && (
                      <>
                        <button
                          onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 py-3 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors mb-3"
                        >
                          <QrCode className="h-4 w-4" />
                          {isExpanded ? "Ocultar QR Code" : "Ver QR Code de entrada"}
                        </button>
                        {isExpanded && (
                          <div className="mb-4 flex flex-col items-center rounded-2xl border bg-white p-6">
                            <Image
                              src={ticket.qrCodeDataUrl}
                              alt="QR Code do ingresso"
                              width={200}
                              height={200}
                              className="rounded-xl"
                            />
                            <p className="mt-3 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 font-mono text-sm text-slate-600 dark:text-slate-400 tracking-wider">
                              {ticket.uuid.slice(0, 8).toUpperCase()}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">Apresente este QR Code na entrada do evento</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Ações */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1.5"
                        disabled={ticket.status === "CANCELED"}
                        onClick={() => downloadPdf(ticket.id)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Baixar PDF
                      </Button>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs px-2"
                          onClick={() => wallet.mutate({ ticketId: ticket.id, provider: "google" })}
                        >
                          <WalletCards className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs px-2"
                          onClick={() => wallet.mutate({ ticketId: ticket.id, provider: "apple" })}
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {ticket.status === "AVAILABLE" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full mt-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs"
                        disabled={refund.isPending}
                        onClick={() => refund.mutate(ticket.id)}
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Solicitar reembolso
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Feedbacks */}
        {refund.isSuccess && (
          <div className="fixed bottom-20 left-4 right-4 md:relative md:bottom-auto md:mt-4 rounded-xl bg-brand-purple/10 border border-brand-purple/20 p-3 text-sm text-brand-purple text-center">
            ✓ Solicitação de reembolso registrada.
          </div>
        )}
        {wallet.isSuccess && (
          <div className="fixed bottom-20 left-4 right-4 md:relative md:bottom-auto md:mt-4 rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700 text-center">
            ✓ Passe Wallet gerado com sucesso.
          </div>
        )}
      </div>
    </main>
  );
}
