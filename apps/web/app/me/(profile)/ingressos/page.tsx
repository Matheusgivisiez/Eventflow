"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar, Download, MapPin, RefreshCcw, Smartphone,
  Ticket, WalletCards, QrCode, CheckCircle2, XCircle, Clock,
  Send, Search, Loader2, UserPlus, Lock, Timer
} from "lucide-react";
import { api } from "@/lib/api";
import { getApiUrl } from "@/lib/api-url";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateTime } from "@/lib/utils";

type MyTicket = {
  id: string;
  uuid: string | null;
  status: "AVAILABLE" | "USED" | "CANCELED";
  qrCodeDataUrl?: string | null;
  qrCodeLocked?: boolean;
  qrCodeReleaseAt?: string | null;
  event: {
    title: string;
    slug: string;
    startsAt: string;
    bannerUrl?: string;
    city?: string;
    state?: string;
    format?: string;
    allowTicketTransfer?: boolean;
    ticketTransferLockTime?: string | null;
  };
  ticketType: {
    name: string;
  };
  order: {
    id: string;
    status: string;
  };
};

type RecipientLookup = {
  exists: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  receiverEmail?: string;
  receiverCpf?: string;
};

const statusConfig = {
  AVAILABLE: { label: "Disponível", icon: CheckCircle2, color: "text-brand-purple bg-brand-purple/10 border-brand-purple/20 dark:bg-brand-purple/20" },
  USED: { label: "Utilizado", icon: Clock, color: "text-brand-violet bg-brand-violet/10 border-brand-violet/20 dark:bg-brand-violet/20" },
  CANCELED: { label: "Cancelado", icon: XCircle, color: "text-brand-pink bg-brand-pink/10 border-brand-pink/20 dark:bg-brand-pink/20" },
};

function useCountdown(targetDate: string | null | undefined, onExpire?: () => void) {
  const [remaining, setRemaining] = useState<{ h: number; m: number; s: number; total: number } | null>(null);

  useEffect(() => {
    if (!targetDate) {
      setRemaining(null);
      return;
    }

    const target = new Date(targetDate).getTime();

    function calculate() {
      const diff = target - Date.now();
      if (diff <= 0) {
        setRemaining(null);
        onExpire?.();
        return false;
      }
      const totalSeconds = Math.floor(diff / 1000);
      setRemaining({
        h: Math.floor(totalSeconds / 3600),
        m: Math.floor((totalSeconds % 3600) / 60),
        s: totalSeconds % 60,
        total: totalSeconds
      });
      return true;
    }

    if (!calculate()) return;

    const interval = setInterval(() => {
      if (!calculate()) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate, onExpire]);

  return remaining;
}

function CountdownTimer({ releaseAt, onExpire }: { releaseAt: string; onExpire: () => void }) {
  const stableOnExpire = useCallback(onExpire, [onExpire]);
  const remaining = useCountdown(releaseAt, stableOnExpire);

  if (!remaining) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="mb-3 rounded-2xl border-2 border-dashed border-amber-400/40 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-5">
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          QR Code bloqueado
        </span>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {[
          { value: pad(remaining.h), label: "h" },
          { value: pad(remaining.m), label: "m" },
          { value: pad(remaining.s), label: "s" },
        ].map((unit, i) => (
          <div key={unit.label} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-lg font-bold text-amber-500/60">:</span>}
            <div className="flex flex-col items-center">
              <span className="rounded-lg bg-white dark:bg-card px-3 py-1.5 font-mono text-xl font-bold text-amber-700 dark:text-amber-300 shadow-sm border border-amber-200/50 dark:border-amber-800/50 min-w-[48px] text-center tabular-nums">
                {unit.value}
              </span>
              <span className="mt-0.5 text-[10px] uppercase tracking-wider text-amber-500/80">
                {unit.label}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-amber-600/80 dark:text-amber-400/80">
        Será liberado em {new Date(releaseAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}

function isTransferLocked(ticket: MyTicket): boolean {
  if (ticket.event.allowTicketTransfer === false) return true;
  if (ticket.event.ticketTransferLockTime && new Date() >= new Date(ticket.event.ticketTransferLockTime)) return true;
  return false;
}

function getTransferLockReason(ticket: MyTicket): string | null {
  if (ticket.event.allowTicketTransfer === false) return "Transferências desabilitadas para este evento";
  if (ticket.event.ticketTransferLockTime && new Date() >= new Date(ticket.event.ticketTransferLockTime)) return "Prazo de transferência encerrado";
  return null;
}

export default function MyTicketsPage() {
  const [scope, setScope] = useState<"future" | "past">("future");
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [transferTicket, setTransferTicket] = useState<MyTicket | null>(null);
  const [recipient, setRecipient] = useState("");
  const [recipientLookup, setRecipientLookup] = useState<RecipientLookup | null>(null);
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const apiUrl = getApiUrl();

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

  const resolveRecipient = useMutation({
    mutationFn: (value: string) => api<RecipientLookup>("/transfers/recipient", {
      method: "POST",
      body: JSON.stringify(recipientPayload(value))
    }),
    onSuccess: (data) => setRecipientLookup(data)
  });

  const createTransfer = useMutation({
    mutationFn: () => {
      if (!transferTicket) throw new Error("Ingresso nao selecionado.");
      return api("/transfers", {
        method: "POST",
        body: JSON.stringify({
          ticketId: transferTicket.id,
          ...recipientPayload(recipient)
        })
      });
    },
    onSuccess: () => {
      setTransferTicket(null);
      setRecipient("");
      setRecipientLookup(null);
      tickets.refetch();
    }
  });

  function openTransferModal(ticket: MyTicket) {
    setTransferTicket(ticket);
    setRecipient("");
    setRecipientLookup(null);
    resolveRecipient.reset();
    createTransfer.reset();
  }

  function recipientPayload(value: string) {
    const clean = value.trim();
    if (clean.includes("@")) {
      return { receiverEmail: clean.toLowerCase() };
    }
    return { receiverCpf: clean.replace(/\D/g, "") };
  }

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
    <main>
      <div className="mx-auto max-w-5xl">
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
              const qrLocked = ticket.qrCodeLocked === true;
              const transferLocked = isTransferLocked(ticket);
              const transferReason = getTransferLockReason(ticket);

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

                    {/* QR Code — countdown timer when locked */}
                    {ticket.status === "AVAILABLE" && qrLocked && ticket.qrCodeReleaseAt && (
                      <CountdownTimer
                        releaseAt={ticket.qrCodeReleaseAt}
                        onExpire={() => tickets.refetch()}
                      />
                    )}

                    {/* QR Code — expandível quando desbloqueado */}
                    {ticket.status === "AVAILABLE" && !qrLocked && ticket.qrCodeDataUrl && (
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
                              {ticket.uuid?.slice(0, 8).toUpperCase() ?? "---"}
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
                        disabled={ticket.status === "CANCELED" || qrLocked}
                        onClick={() => downloadPdf(ticket.id)}
                        title={qrLocked ? "QR Code bloqueado — aguarde a liberação" : undefined}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Baixar PDF
                      </Button>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs px-2"
                          disabled={qrLocked}
                          onClick={() => wallet.mutate({ ticketId: ticket.id, provider: "google" })}
                          title={qrLocked ? "QR Code bloqueado — aguarde a liberação" : undefined}
                        >
                          <WalletCards className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs px-2"
                          disabled={qrLocked}
                          onClick={() => wallet.mutate({ ticketId: ticket.id, provider: "apple" })}
                          title={qrLocked ? "QR Code bloqueado — aguarde a liberação" : undefined}
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {ticket.status === "AVAILABLE" && (
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {!transferLocked ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl gap-1.5 text-xs"
                            onClick={() => openTransferModal(ticket)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            Transferir
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl gap-1.5 text-xs opacity-50 cursor-not-allowed"
                            disabled
                            title={transferReason ?? "Transferência indisponível"}
                          >
                            <Lock className="h-3.5 w-3.5" />
                            Transferir
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs"
                          disabled={refund.isPending}
                          onClick={() => refund.mutate(ticket.id)}
                        >
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Solicitar reembolso
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={Boolean(transferTicket)} onOpenChange={(open) => !open && setTransferTicket(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Transferir ingresso</DialogTitle>
              <DialogDescription>
                Informe o e-mail ou CPF do destinatario para iniciar uma transferencia pendente.
              </DialogDescription>
            </DialogHeader>

            {transferTicket && (
              <div className="rounded-xl border bg-muted/40 p-3 text-sm">
                <p className="font-semibold">{transferTicket.event.title}</p>
                <p className="text-muted-foreground">{transferTicket.ticketType.name} - {dateTime(transferTicket.event.startsAt)}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="recipient">E-mail ou CPF</Label>
              <div className="flex gap-2">
                <Input
                  id="recipient"
                  value={recipient}
                  onChange={(event) => {
                    setRecipient(event.target.value);
                    setRecipientLookup(null);
                    resolveRecipient.reset();
                    createTransfer.reset();
                  }}
                  placeholder="destino@email.com ou 00000000000"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!recipient.trim() || resolveRecipient.isPending}
                  onClick={() => resolveRecipient.mutate(recipient)}
                  title="Buscar destinatario"
                >
                  {resolveRecipient.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {recipientLookup && (
              <div className="rounded-xl border p-4">
                {recipientLookup.exists && recipientLookup.user ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {recipientLookup.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">{recipientLookup.user.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{recipientLookup.user.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <UserPlus className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">Destinatario ainda nao cadastrado</p>
                      <p className="text-sm text-muted-foreground">Ele recebera um convite e podera aceitar depois de criar a conta.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {resolveRecipient.isError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {(resolveRecipient.error as Error).message}
              </p>
            )}

            {createTransfer.isError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {(createTransfer.error as Error).message}
              </p>
            )}

            {createTransfer.isSuccess && (
              <p className="rounded-lg border border-brand-purple/20 bg-brand-purple/10 p-3 text-sm text-brand-purple">
                Transferencia criada com sucesso.
              </p>
            )}

            <Button
              className="w-full rounded-xl"
              disabled={!recipientLookup || createTransfer.isPending}
              onClick={() => createTransfer.mutate()}
            >
              {createTransfer.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Confirmar transferencia
            </Button>
          </DialogContent>
        </Dialog>

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
