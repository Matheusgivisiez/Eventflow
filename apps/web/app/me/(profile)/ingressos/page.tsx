"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import {
  Download,
  MapPin,
  RefreshCcw,
  Smartphone,
  Ticket,
  WalletCards,
  QrCode,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Search,
  Loader2,
  UserPlus,
  Lock,
  ArrowUpRight,
  CircleAlert,
  RotateCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { getApiUrl } from "@/lib/api-url";
import { publicAssetUrl } from "@/lib/public-asset-url";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateTime } from "@/lib/utils";
import { BrandMark } from "@/components/brand-logo";

type MyTicket = {
  id: string;
  uuid: string | null;
  attendeeName: string;
  status: "AVAILABLE" | "USED" | "CANCELED";
  qrCodeDataUrl?: string | null;
  qrCodeLocked?: boolean;
  qrCodeReleaseAt?: string | null;
  event: {
    title: string;
    slug: string;
    startsAt: string;
    endsAt?: string | null;
    bannerUrl?: string;
    address?: string;
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
  AVAILABLE: {
    label: "Ativo",
    icon: CheckCircle2,
    color: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  },
  USED: {
    label: "Utilizado",
    icon: Clock,
    color: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  },
  CANCELED: {
    label: "Cancelado",
    icon: XCircle,
    color: "border-rose-300/20 bg-rose-300/10 text-rose-200",
  },
};

function useCountdown(
  targetDate: string | null | undefined,
  onExpire?: () => void,
) {
  const [remaining, setRemaining] = useState<{
    h: number;
    m: number;
    s: number;
    total: number;
  } | null>(null);

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
        total: totalSeconds,
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

function isTransferLocked(ticket: MyTicket): boolean {
  if (ticket.event.allowTicketTransfer === false) return true;
  if (
    ticket.event.ticketTransferLockTime &&
    new Date() >= new Date(ticket.event.ticketTransferLockTime)
  )
    return true;
  return false;
}

function getTransferLockReason(ticket: MyTicket): string | null {
  if (ticket.event.allowTicketTransfer === false)
    return "Transferências desabilitadas para este evento";
  if (
    ticket.event.ticketTransferLockTime &&
    new Date() >= new Date(ticket.event.ticketTransferLockTime)
  )
    return "Prazo de transferência encerrado";
  return null;
}

function eventSchedule(startsAt: string) {
  const date = new Date(startsAt);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase();
  const dayAndMonth = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replace(".", "")
    .toUpperCase();
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return { weekday, dayAndMonth, time };
}

function eventLocation(ticket: MyTicket) {
  if (ticket.event.format === "ONLINE") return "Evento online";
  const region = [ticket.event.city, ticket.event.state]
    .filter(Boolean)
    .join(", ");
  return (
    [ticket.event.address, region].filter(Boolean).join(" · ") ||
    "Local a confirmar"
  );
}

type EventTicketCardProps = {
  ticket: MyTicket;
  expanded: boolean;
  refundPending: boolean;
  onToggleDetails: () => void;
  onQrRelease: () => void;
  onDownload: () => void;
  onWallet: (provider: "google" | "apple") => void;
  onTransfer: () => void;
  onRefund: () => void;
};

function EventTicketCard({
  ticket,
  expanded,
  refundPending,
  onToggleDetails,
  onQrRelease,
  onDownload,
  onWallet,
  onTransfer,
  onRefund,
}: EventTicketCardProps) {
  const cfg = statusConfig[ticket.status];
  const StatusIcon = cfg.icon;
  const schedule = eventSchedule(ticket.event.startsAt);
  const qrLocked = ticket.qrCodeLocked === true;
  const stableOnQrRelease = useCallback(onQrRelease, [onQrRelease]);
  const qrRemaining = useCountdown(
    qrLocked ? ticket.qrCodeReleaseAt : null,
    stableOnQrRelease,
  );
  const qrHoursRemaining = qrRemaining
    ? Math.ceil(qrRemaining.total / 3600)
    : null;
  const canOpenQr =
    ticket.status === "AVAILABLE" && !qrLocked && Boolean(ticket.qrCodeDataUrl);
  const transferLocked = isTransferLocked(ticket);
  const transferReason = getTransferLockReason(ticket);
  const bannerUrl = publicAssetUrl(ticket.event.bannerUrl);
  const detailsPanelId = `ticket-details-${ticket.id}`;

  return (
    <article className="group mx-1 animate-slide-up">
      <div className="relative isolate overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#191725] text-[#f7f5ff] shadow-[0_22px_55px_rgba(15,10,35,0.18)] dark:shadow-[0_22px_60px_rgba(0,0,0,0.38)]">
        <button
          type="button"
          aria-controls={detailsPanelId}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Recolher" : "Abrir"} ingresso de ${ticket.event.title}`}
          onClick={onToggleDetails}
          className="relative grid min-h-[172px] w-full grid-cols-[82px_minmax(0,1fr)_52px] overflow-hidden text-left transition-colors duration-300 hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400 sm:min-h-[194px] sm:grid-cols-[160px_minmax(0,1fr)_82px]"
        >
          <span className="relative overflow-hidden bg-[#28223d]">
            {bannerUrl ? (
              <Image
                src={bannerUrl}
                alt={`Capa do evento ${ticket.event.title}`}
                fill
                sizes="(min-width: 640px) 160px, 82px"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[#28223d]">
                <Ticket className="h-8 w-8 text-violet-300/70 sm:h-11 sm:w-11" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/15" />
            <span
              aria-hidden="true"
              className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full border border-white/[0.06] bg-black/15 p-1.5 backdrop-blur-sm sm:bottom-4"
            >
              <BrandMark className="h-5 w-6 opacity-25 grayscale sm:h-6 sm:w-7" />
            </span>
          </span>

          <span className="min-w-0 px-3 py-3.5 sm:px-5 sm:py-5">
            <span className="flex flex-wrap items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-violet-200/80 sm:text-xs sm:tracking-[0.16em]">
              <span>{schedule.weekday}</span>
              <span className="text-white/25">•</span>
              <span>{schedule.dayAndMonth}</span>
              <span className="text-white/25">•</span>
              <span>{schedule.time}</span>
            </span>

            <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-[1.22] tracking-[-0.02em] text-white sm:mt-3 sm:text-xl">
              {ticket.event.title}
            </h3>

            <span className="mt-2 flex min-w-0 items-start gap-1.5 text-[10px] leading-relaxed text-white/55 sm:mt-3 sm:text-sm">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-violet-300 sm:h-4 sm:w-4" />
              <span className="line-clamp-2">{eventLocation(ticket)}</span>
            </span>

            <span className="mt-3 block border-t border-white/10 pt-3 sm:mt-4 sm:flex sm:items-end sm:justify-between sm:gap-3">
              <span className="block min-w-0">
                <span className="block text-[8px] font-semibold uppercase tracking-[0.17em] text-white/35 sm:text-[10px]">
                  Titular
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/90 sm:text-sm">
                  {ticket.attendeeName}
                </span>
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-0 sm:justify-end">
                <span className="max-w-full truncate rounded-full border border-violet-300/15 bg-violet-300/10 px-2 py-1 text-[9px] font-semibold text-violet-100 sm:max-w-[150px] sm:px-2.5 sm:text-[10px]">
                  {ticket.ticketType.name}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold sm:text-[10px] ${cfg.color}`}
                >
                  <StatusIcon className="h-2.5 w-2.5" />
                  {cfg.label}
                </span>
              </span>
            </span>
          </span>

          <span className="relative flex flex-col items-center border-l border-dashed border-white/20 bg-[#211e31] px-1 text-center sm:px-3">
            <span className="absolute top-3 flex h-8 w-8 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-300/10 text-violet-200 sm:top-4 sm:h-10 sm:w-10">
              {qrLocked ? (
                <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <QrCode className="h-5 w-5 sm:h-7 sm:w-7" />
              )}
            </span>
            <span className="absolute bottom-3 flex flex-col items-center sm:bottom-4">
              <span className="font-mono text-[11px] font-bold tabular-nums text-violet-100 sm:text-sm">
                {qrLocked && qrHoursRemaining !== null
                  ? `${qrHoursRemaining}h`
                  : canOpenQr
                    ? "QR"
                    : "—"}
              </span>
              <span className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-white/35 sm:text-[8px]">
                {qrLocked && qrHoursRemaining !== null
                  ? "faltam"
                  : canOpenQr
                    ? "entrada"
                    : "indisp."}
              </span>
            </span>
          </span>

          <span className="pointer-events-none absolute -left-3 top-1/3 z-20 h-6 w-6 -translate-y-1/2 rounded-full bg-[#F8F8F8] dark:bg-background" />
          <span className="pointer-events-none absolute -left-3 top-2/3 z-20 h-6 w-6 -translate-y-1/2 rounded-full bg-[#F8F8F8] dark:bg-background" />
          <span className="pointer-events-none absolute -right-3 top-1/3 z-20 h-6 w-6 -translate-y-1/2 rounded-full bg-[#F8F8F8] dark:bg-background" />
          <span className="pointer-events-none absolute -right-3 top-2/3 z-20 h-6 w-6 -translate-y-1/2 rounded-full bg-[#F8F8F8] dark:bg-background" />
        </button>

        {expanded && (
          <div id={detailsPanelId} className="animate-slide-up">
            {canOpenQr && (
              <div className="border-t border-dashed border-white/15 bg-[#111019] px-4 py-6 sm:px-6">
                <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                  <div className="rounded-[22px] bg-white p-3 shadow-[0_14px_35px_rgba(0,0,0,0.32)]">
                    <Image
                      src={ticket.qrCodeDataUrl!}
                      alt={`QR Code do ingresso para ${ticket.event.title}`}
                      width={208}
                      height={208}
                      unoptimized
                      className="h-44 w-44 rounded-xl sm:h-52 sm:w-52"
                    />
                  </div>
                  <p className="mt-4 font-mono text-sm font-semibold tracking-[0.18em] text-violet-200">
                    {ticket.uuid?.slice(0, 8).toUpperCase() ?? "---"}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/50">
                    Apresente este código na entrada. Evite compartilhar a tela
                    com outras pessoas.
                  </p>
                </div>
              </div>
            )}

            <div className="border-t border-dashed border-white/15 bg-[#14121f] p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_44px_44px]">
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11 gap-1.5 rounded-xl border-white/10 bg-white/[0.05] text-xs text-white hover:bg-white/10 hover:text-white"
                  disabled={ticket.status === "CANCELED" || qrLocked}
                  onClick={onDownload}
                  title={
                    qrLocked
                      ? "QR Code bloqueado — aguarde a liberação"
                      : undefined
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar ingresso
                </Button>

                {ticket.status === "AVAILABLE" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 gap-1.5 rounded-xl border-white/10 bg-white/[0.05] text-xs text-white hover:bg-white/10 hover:text-white"
                    disabled={transferLocked}
                    onClick={onTransfer}
                    title={transferReason ?? undefined}
                  >
                    {transferLocked ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Transferir
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 rounded-xl border-white/10 bg-white/[0.03] text-xs text-white/35"
                    disabled
                  >
                    Transferência indisponível
                  </Button>
                )}

                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Adicionar ao Google Wallet"
                  className="min-h-11 w-full rounded-xl border-white/10 bg-white/[0.05] text-white hover:bg-white/10 hover:text-white sm:w-11"
                  disabled={ticket.status !== "AVAILABLE" || qrLocked}
                  onClick={() => onWallet("google")}
                >
                  <WalletCards className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Adicionar à Apple Wallet"
                  className="min-h-11 w-full rounded-xl border-white/10 bg-white/[0.05] text-white hover:bg-white/10 hover:text-white sm:w-11"
                  disabled={ticket.status !== "AVAILABLE" || qrLocked}
                  onClick={() => onWallet("apple")}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>

              {ticket.status === "AVAILABLE" && (
                <button
                  type="button"
                  className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-xs text-white/40 transition-colors hover:bg-rose-300/[0.06] hover:text-rose-200 disabled:opacity-50"
                  disabled={refundPending}
                  onClick={onRefund}
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Solicitar reembolso
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default function MyTicketsPage() {
  const [scope, setScope] = useState<"future" | "past">("future");
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [transferTicket, setTransferTicket] = useState<MyTicket | null>(null);
  const [recipient, setRecipient] = useState("");
  const [recipientLookup, setRecipientLookup] =
    useState<RecipientLookup | null>(null);
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const apiUrl = getApiUrl();

  const tickets = useQuery({
    queryKey: ["my-tickets", user?.id, scope],
    queryFn: () => api<MyTicket[]>(`/buyer/tickets?scope=${scope}`),
    enabled: Boolean(user?.id),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const ticketItems = tickets.data ?? [];

  const refund = useMutation({
    mutationFn: (ticketId: string) =>
      api(`/buyer/tickets/${ticketId}/refund`, { method: "POST" }),
    onSuccess: () => tickets.refetch(),
  });

  const wallet = useMutation({
    mutationFn: ({
      ticketId,
      provider,
    }: {
      ticketId: string;
      provider: "google" | "apple";
    }) => api(`/buyer/tickets/${ticketId}/${provider}-wallet`),
  });

  const resolveRecipient = useMutation({
    mutationFn: (value: string) =>
      api<RecipientLookup>("/transfers/recipient", {
        method: "POST",
        body: JSON.stringify(recipientPayload(value)),
      }),
    onSuccess: (data) => setRecipientLookup(data),
  });

  const createTransfer = useMutation({
    mutationFn: () => {
      if (!transferTicket) throw new Error("Ingresso nao selecionado.");
      return api("/transfers", {
        method: "POST",
        body: JSON.stringify({
          ticketId: transferTicket.id,
          ...recipientPayload(recipient),
        }),
      });
    },
    onSuccess: () => {
      setTransferTicket(null);
      setRecipient("");
      setRecipientLookup(null);
      tickets.refetch();
    },
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
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
    <main aria-labelledby="ticket-list-title">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7 grid grid-cols-2 gap-2 rounded-2xl border bg-card/70 p-1.5 shadow-sm">
          <button
            type="button"
            aria-pressed={scope === "future"}
            onClick={() => setScope("future")}
            className={`min-h-11 rounded-xl px-3 py-3 text-sm font-semibold transition-all ${
              scope === "future"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            Eventos futuros
          </button>
          <button
            type="button"
            aria-pressed={scope === "past"}
            onClick={() => setScope("past")}
            className={`min-h-11 rounded-xl px-3 py-3 text-sm font-semibold transition-all ${
              scope === "past"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            Eventos passados
          </button>
        </div>

        {tickets.isLoading ? (
          <div className="space-y-5" aria-label="Carregando ingressos">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="overflow-hidden rounded-[28px] border bg-[#191725]"
              >
                <div className="grid min-h-[172px] grid-cols-[82px_minmax(0,1fr)_52px] sm:min-h-[194px] sm:grid-cols-[160px_minmax(0,1fr)_82px]">
                  <Skeleton className="h-full w-full rounded-none bg-white/10" />
                  <div className="space-y-3 p-3.5 sm:p-5">
                    <Skeleton className="h-3 w-2/3 bg-white/10" />
                    <Skeleton className="h-5 w-full bg-white/10" />
                    <Skeleton className="h-4 w-4/5 bg-white/10" />
                    <Skeleton className="mt-5 h-7 w-full bg-white/10" />
                  </div>
                  <div className="border-l border-dashed border-white/15 bg-white/[0.03]" />
                </div>
              </div>
            ))}
          </div>
        ) : tickets.isError ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center rounded-[28px] border border-rose-300/20 bg-card px-6 py-14 text-center shadow-sm"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
              <CircleAlert className="h-7 w-7" />
            </div>
            <h2 id="ticket-list-title" className="text-xl font-bold">
              Não foi possível carregar seus ingressos
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {(tickets.error as Error).message ||
                "Tivemos uma falha temporária ao consultar sua carteira."}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-6 min-h-11 gap-2 rounded-xl"
              onClick={() => tickets.refetch()}
            >
              <RotateCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        ) : ticketItems.length === 0 ? (
          <div className="relative overflow-hidden rounded-[28px] border border-dashed bg-card px-6 py-16 text-center shadow-sm">
            <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full border-[26px] border-primary/[0.06]" />
            <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10">
              <Ticket className="h-8 w-8 text-primary" />
            </div>
            <h2 id="ticket-list-title" className="relative text-xl font-bold">
              Nenhum ingresso encontrado
            </h2>
            <p className="relative mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {scope === "future"
                ? "Sua carteira está pronta. Quando uma compra for confirmada, o ingresso aparecerá aqui automaticamente."
                : "Você ainda não tem ingressos de eventos passados."}
            </p>
            <Button
              asChild
              className="relative mt-6 min-h-11 gap-2 rounded-xl bg-primary text-white hover:bg-primary/90"
            >
              <Link href="/">
                Explorar eventos
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="pb-6">
            <div className="mb-4 flex items-end justify-between gap-4 px-1">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Sua carteira
                </p>
                <h2
                  id="ticket-list-title"
                  className="mt-1 text-xl font-bold tracking-tight sm:text-2xl"
                >
                  {scope === "future" ? "Próximos eventos" : "Eventos passados"}
                </h2>
              </div>
              <span className="rounded-full border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
                {ticketItems.length}{" "}
                {ticketItems.length === 1 ? "ingresso" : "ingressos"}
              </span>
            </div>

            <div className="stagger-children space-y-5">
              {ticketItems.map((ticket) => (
                <EventTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  expanded={expandedTicket === ticket.id}
                  refundPending={
                    refund.isPending && refund.variables === ticket.id
                  }
                  onToggleDetails={() =>
                    setExpandedTicket((current) =>
                      current === ticket.id ? null : ticket.id,
                    )
                  }
                  onQrRelease={() => void tickets.refetch()}
                  onDownload={() => void downloadPdf(ticket.id)}
                  onWallet={(provider) =>
                    wallet.mutate({ ticketId: ticket.id, provider })
                  }
                  onTransfer={() => openTransferModal(ticket)}
                  onRefund={() => refund.mutate(ticket.id)}
                />
              ))}
            </div>
          </div>
        )}

        <Dialog
          open={Boolean(transferTicket)}
          onOpenChange={(open) => !open && setTransferTicket(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Transferir ingresso</DialogTitle>
              <DialogDescription>
                Informe o e-mail ou CPF do destinatario para iniciar uma
                transferencia pendente.
              </DialogDescription>
            </DialogHeader>

            {transferTicket && (
              <div className="rounded-xl border bg-muted/40 p-3 text-sm">
                <p className="font-semibold">{transferTicket.event.title}</p>
                <p className="text-muted-foreground">
                  {transferTicket.ticketType.name} -{" "}
                  {dateTime(transferTicket.event.startsAt)}
                </p>
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
                  {resolveRecipient.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
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
                      <p className="font-semibold">
                        {recipientLookup.user.name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {recipientLookup.user.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <UserPlus className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">
                        Destinatario ainda nao cadastrado
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Ele recebera um convite e podera aceitar depois de criar
                        a conta.
                      </p>
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
              {createTransfer.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
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
