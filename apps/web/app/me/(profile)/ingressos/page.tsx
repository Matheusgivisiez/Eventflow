"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import {
  Download,
  MapPin,
  RefreshCcw,
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
  Calendar,
  Sparkles,
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
  refundAvailable?: boolean;
  refundBlockedReason?: string | null;
  refundDeadline?: string | null;
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
  pendingTransfer?: {
    id: string;
    receiverName: string | null;
    receiverEmail: string | null;
    createdAt: string;
    expiresAt: string | null;
  } | null;
};

type RecipientLookup = {
  exists: boolean;
  /** Nome e e-mail vem mascarados pela API: servem para conferir, nao para copiar. */
  user?: {
    name: string;
    email: string;
  };
  receiverEmail?: string;
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
  transferCancelPending: boolean;
  onToggleDetails: () => void;
  onQrRelease: () => void;
  onDownload: () => void;
  walletEnabled: boolean;
  walletPending: boolean;
  onWallet: () => void;
  onTransfer: () => void;
  onCancelTransfer: () => void;
  onRefund: () => void;
};

function EventTicketCard({
  ticket,
  expanded,
  refundPending,
  transferCancelPending,
  onToggleDetails,
  onQrRelease,
  onDownload,
  walletEnabled,
  walletPending,
  onWallet,
  onTransfer,
  onCancelTransfer,
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
  const pendingTransfer = ticket.pendingTransfer;
  const pendingRecipient =
    pendingTransfer?.receiverName ?? pendingTransfer?.receiverEmail ?? "destinatário";
  const bannerUrl = publicAssetUrl(ticket.event.bannerUrl);
  const detailsPanelId = `ticket-details-${ticket.id}`;
  const topBadgeLabel = `Ingresso ${cfg.label}`;
  const TopBadgeIcon = ticket.status === "AVAILABLE" ? Sparkles : StatusIcon;

  return (
    <article className="group mx-1 animate-slide-up">
      <div className="relative isolate overflow-hidden rounded-[24px] border border-violet-500/25 bg-[#151226]/95 text-[#f7f5ff] shadow-[0_20px_50px_rgba(0,0,0,0.4),0_0_30px_rgba(139,92,246,0.08)] backdrop-blur-md sm:rounded-[28px]">
        <button
          type="button"
          aria-controls={detailsPanelId}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Recolher" : "Abrir"} ingresso de ${ticket.event.title}`}
          onClick={onToggleDetails}
          className="relative grid w-full grid-cols-[100px_minmax(0,1fr)_92px] items-stretch text-left transition-colors duration-300 hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400 sm:grid-cols-[224px_minmax(0,1fr)_176px]"
        >
          <span className="relative h-full min-h-[168px] w-full overflow-hidden rounded-l-[24px] sm:rounded-l-[28px]">
            {bannerUrl ? (
              <Image
                src={bannerUrl}
                alt={`Capa do evento ${ticket.event.title}`}
                fill
                sizes="(min-width: 640px) 224px, 100px"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-900/60 to-[#211c38]">
                <Ticket className="h-8 w-8 text-violet-300/70 sm:h-11 sm:w-11" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </span>

          <span className="min-w-0 px-4 py-3.5 sm:px-8 sm:py-6">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-violet-200/80 sm:text-xs sm:tracking-[0.16em]">
                <Calendar className="h-3 w-3 text-violet-300 sm:h-3.5 sm:w-3.5" />
                {schedule.weekday} · {schedule.dayAndMonth} · {schedule.time}
              </span>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] sm:text-[10px] ${
                  ticket.status === "AVAILABLE"
                    ? "border-violet-400/30 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-violet-100"
                    : cfg.color
                }`}
              >
                <TopBadgeIcon className="h-3 w-3" />
                {topBadgeLabel}
              </span>
            </span>

            <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-[1.22] tracking-[-0.02em] text-white sm:mt-3 sm:text-2xl">
              {ticket.event.title}
            </h3>

            <span className="mt-1.5 flex min-w-0 items-start gap-1.5 text-[10px] leading-relaxed text-white/55 sm:mt-2.5 sm:text-sm">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-violet-300 sm:h-4 sm:w-4" />
              <span className="line-clamp-2">{eventLocation(ticket)}</span>
            </span>

            {pendingTransfer && (
              <span className="mt-2 flex max-w-full items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-2 py-1.5 text-[9px] font-semibold text-amber-100 sm:text-xs">
                <Clock className="h-3 w-3 shrink-0 text-amber-300" />
                <span className="truncate">Aguardando aceite de {pendingRecipient}</span>
              </span>
            )}

            <span className="mt-2.5 block border-t border-dashed border-white/10 pt-2.5 sm:mt-4 sm:flex sm:items-end sm:justify-between sm:gap-3 sm:pt-4">
              <span className="block min-w-0">
                <span className="block text-[8px] font-semibold uppercase tracking-[0.17em] text-white/35 sm:text-[10px]">
                  Titular
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/90 sm:text-sm">
                  {ticket.attendeeName}
                </span>
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-0 sm:justify-end">
                <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-violet-300/15 bg-violet-300/10 px-2 py-1 text-[9px] font-semibold text-violet-100 sm:max-w-[150px] sm:px-2.5 sm:text-[10px]">
                  <Ticket className="h-2.5 w-2.5 shrink-0" />
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

          <span className="relative flex h-full flex-col items-center justify-between gap-2 border-l border-dashed border-violet-300/25 px-2.5 py-4 text-center sm:gap-3 sm:px-6 sm:py-6">
            <span className="text-[8px] font-bold uppercase leading-tight tracking-[0.14em] text-white/40 sm:text-[11px] sm:tracking-[0.2em]">
              QR entrada
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/25 bg-white/[0.03] text-violet-200 sm:h-16 sm:w-16 sm:rounded-2xl">
              {qrLocked ? (
                <Lock className="h-4 w-4 sm:h-6 sm:w-6" />
              ) : (
                <QrCode className="h-5 w-5 sm:h-7 sm:w-7" />
              )}
            </span>
            <span className="max-w-[80px] text-[8px] font-bold uppercase leading-tight tracking-[0.06em] text-white/50 sm:max-w-[140px] sm:text-[10px] sm:tracking-[0.1em]">
              {qrLocked && qrHoursRemaining !== null
                ? `Libera em ${qrHoursRemaining}h`
                : canOpenQr
                  ? "Escaneie para entrar"
                  : "QR indisponível"}
            </span>

            <span className="mt-auto flex items-center gap-1 text-white/40">
              <BrandMark className="h-3 w-3.5 opacity-70 sm:h-3.5 sm:w-4" />
              <span className="text-[7px] font-bold uppercase tracking-[0.18em] sm:text-[9px] sm:tracking-[0.22em]">
                Event Flow
              </span>
            </span>

            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-3 left-0 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F8F8F8] dark:bg-background"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-3 left-0 h-6 w-6 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#F8F8F8] dark:bg-background"
            />
          </span>
        </button>

        {expanded && (
          <div id={detailsPanelId} className="animate-slide-up border-t border-dashed border-violet-300/20">
            <div className="bg-[#121024]/90 backdrop-blur-xl">
              {canOpenQr && (
                <div className="px-4 py-6 sm:px-8 sm:py-8">
                  <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                    <div className="rounded-3xl bg-white p-4 shadow-2xl sm:p-5">
                      <Image
                        src={ticket.qrCodeDataUrl!}
                        alt={`QR Code do ingresso para ${ticket.event.title}`}
                        width={208}
                        height={208}
                        unoptimized
                        className="h-44 w-44 rounded-xl sm:h-52 sm:w-52"
                      />
                    </div>
                    <p className="mt-4 font-mono text-sm font-semibold tracking-[0.35em] text-violet-200">
                      {ticket.uuid?.slice(0, 8).toUpperCase() ?? "--------"}
                    </p>
                    <p className="mt-3 text-xs leading-relaxed text-white/50">
                      Apresente este código na entrada. Evite compartilhar a tela
                      com outras pessoas.
                    </p>
                  </div>
                </div>
              )}

              {ticket.status === "USED" && (
                <div className="px-4 py-6 sm:px-8 sm:py-8">
                  <div className="mx-auto flex max-w-sm flex-col items-center rounded-2xl border border-violet-500/30 bg-violet-500/10 p-6 text-center">
                    <Clock className="mb-2 h-10 w-10 text-violet-400" />
                    <h4 className="text-base font-bold text-violet-200">Ingresso utilizado</h4>
                    <p className="mt-1 text-xs text-white/60">
                      Check-in confirmado na portaria. Este ingresso já foi validado para entrada no evento.
                    </p>
                    {ticket.uuid && (
                      <span className="mt-3 rounded-full bg-violet-500/20 px-3 py-1 font-mono text-xs text-violet-300/80">
                        #{ticket.uuid.slice(0, 8).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {ticket.status === "CANCELED" && (
                <div className="px-4 py-6 sm:px-8 sm:py-8">
                  <div className="mx-auto flex max-w-sm flex-col items-center rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
                    <XCircle className="mb-2 h-10 w-10 text-rose-400" />
                    <h4 className="text-base font-bold text-rose-200">Ingresso cancelado</h4>
                    <p className="mt-1 text-xs text-white/60">
                      Este ingresso foi cancelado ou reembolsado e não pode mais ser utilizado.
                    </p>
                  </div>
                </div>
              )}

              <div className="border-t border-dashed border-violet-300/15 p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 gap-1.5 rounded-xl border border-transparent bg-gradient-to-r from-[#7033ff] to-[#9333ea] text-xs font-semibold text-white shadow-[0_10px_25px_rgba(124,58,237,0.35)] hover:text-white hover:brightness-110"
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

                  {ticket.status === "AVAILABLE" && pendingTransfer ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11 gap-1.5 rounded-xl border-amber-300/25 bg-amber-300/10 text-xs text-amber-100 hover:bg-amber-300/20 hover:text-amber-50"
                      disabled={transferCancelPending}
                      onClick={onCancelTransfer}
                    >
                      {transferCancelPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      Cancelar transferência
                    </Button>
                  ) : ticket.status === "AVAILABLE" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11 gap-1.5 rounded-xl border-white/15 bg-white/5 text-xs text-white backdrop-blur hover:bg-white/10 hover:text-white"
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

                  {walletEnabled && ticket.status === "AVAILABLE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="col-span-2 min-h-11 gap-2 rounded-xl border-white/15 bg-white/5 text-xs font-semibold text-white backdrop-blur hover:bg-white/10 hover:text-white"
                      disabled={qrLocked || walletPending}
                      onClick={onWallet}
                      title={
                        qrLocked
                          ? "Disponível quando o QR Code for liberado"
                          : undefined
                      }
                    >
                      {walletPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <WalletCards className="h-4 w-4" />
                      )}
                      Adicionar ao Google Wallet
                    </Button>
                  )}
                </div>

                {ticket.status === "AVAILABLE" && ticket.refundAvailable && (
                  <button
                    type="button"
                    className="mt-3.5 flex min-h-11 w-full flex-col items-center justify-center border-t border-dashed border-white/10 pt-3.5 text-xs text-white/40 transition-colors hover:text-rose-200 disabled:opacity-50"
                    disabled={refundPending || Boolean(pendingTransfer)}
                    onClick={onRefund}
                    title={pendingTransfer ? "Cancele a transferência pendente antes de solicitar reembolso" : undefined}
                  >
                    <span className="flex items-center gap-1.5">
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Solicitar reembolso
                    </span>
                    {ticket.refundDeadline && (
                      <span className="text-[11px] text-white/30">
                        Disponível até {dateTime(ticket.refundDeadline)}
                      </span>
                    )}
                  </button>
                )}
                {ticket.status === "AVAILABLE" && !ticket.refundAvailable && ticket.refundBlockedReason && (
                  <p className="mt-3.5 flex min-h-11 items-center justify-center border-t border-dashed border-white/10 pt-3.5 text-center text-[11px] text-white/30">
                    {ticket.refundBlockedReason}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default function MyTicketsPage() {
  const [statusTab, setStatusTab] = useState<"AVAILABLE" | "USED" | "CANCELED">("AVAILABLE");
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [transferTicket, setTransferTicket] = useState<MyTicket | null>(null);
  const [recipient, setRecipient] = useState("");
  const [transferConfirmation, setTransferConfirmation] = useState("");
  const [refundTicket, setRefundTicket] = useState<MyTicket | null>(null);
  const [refundConfirmation, setRefundConfirmation] = useState("");
  const [recipientLookup, setRecipientLookup] =
    useState<RecipientLookup | null>(null);
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const apiUrl = getApiUrl();

  const tickets = useQuery({
    queryKey: ["my-tickets", user?.id],
    queryFn: () => api<MyTicket[]>("/buyer/tickets"),
    enabled: Boolean(user?.id),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      if (query.state.error) return false;
      const data = query.state.data as MyTicket[] | undefined;
      const hasActive = data?.some((t) => t.status === "AVAILABLE");
      return statusTab === "AVAILABLE" && hasActive ? 60_000 : false;
    },
  });

  const allTickets = useMemo(() => tickets.data ?? [], [tickets.data]);
  const activeTickets = useMemo(
    () => allTickets.filter((t) => t.status === "AVAILABLE"),
    [allTickets],
  );
  const usedTickets = useMemo(
    () => allTickets.filter((t) => t.status === "USED"),
    [allTickets],
  );
  const canceledTickets = useMemo(
    () => allTickets.filter((t) => t.status === "CANCELED"),
    [allTickets],
  );

  const displayedTickets =
    statusTab === "AVAILABLE"
      ? activeTickets
      : statusTab === "USED"
        ? usedTickets
        : canceledTickets;

  const refund = useMutation({
    mutationFn: ({
      ticketId,
      confirmation,
    }: {
      ticketId: string;
      confirmation: string;
    }) =>
      api(`/buyer/tickets/${ticketId}/refund`, {
        method: "POST",
        body: JSON.stringify({ confirmation }),
      }),
    onSuccess: () => {
      setRefundTicket(null);
      setRefundConfirmation("");
      tickets.refetch();
    },
  });

  const walletConfig = useQuery({
    queryKey: ["wallet-config"],
    queryFn: () => api<{ google: boolean }>("/buyer/wallet/config"),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const wallet = useMutation({
    mutationFn: (ticketId: string) =>
      api<{ saveUrl: string }>(`/buyer/tickets/${ticketId}/google-wallet`, {
        method: "POST",
      }),
    // Leva o usuário para o Google: no Android abre o app Wallet direto.
    onSuccess: ({ saveUrl }) => window.location.assign(saveUrl),
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
          confirmation: transferConfirmation,
        }),
      });
    },
    onSuccess: async () => {
      await tickets.refetch();
      setTransferTicket(null);
      setRecipient("");
      setTransferConfirmation("");
      setRecipientLookup(null);
    },
  });

  const cancelTransfer = useMutation({
    mutationFn: (transferId: string) =>
      api(`/transfers/${transferId}/cancel`, { method: "POST" }),
    onSuccess: async () => {
      await tickets.refetch();
    },
  });

  function openTransferModal(ticket: MyTicket) {
    setTransferTicket(ticket);
    setRecipient("");
    setTransferConfirmation("");
    setRecipientLookup(null);
    resolveRecipient.reset();
    createTransfer.reset();
  }

  function closeTransferModal() {
    setTransferTicket(null);
    setRecipient("");
    setTransferConfirmation("");
    setRecipientLookup(null);
    resolveRecipient.reset();
    createTransfer.reset();
  }

  function openRefundDialog(ticket: MyTicket) {
    setRefundTicket(ticket);
    setRefundConfirmation("");
    refund.reset();
  }

  function closeRefundDialog() {
    setRefundTicket(null);
    setRefundConfirmation("");
    refund.reset();
  }

  function recipientPayload(value: string) {
    return { receiverEmail: value.trim().toLowerCase() };
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
        {user && user.emailVerified === false && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-foreground">Confirme seu e-mail para reunir seus ingressos</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Compras feitas sem conta com {user.email} só aparecem aqui depois da confirmação.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="secondary" className="shrink-0">
              <Link href="/verificar-email">Confirmar e-mail</Link>
            </Button>
          </div>
        )}

        <div className="mb-7 grid grid-cols-3 gap-2 rounded-2xl border bg-card/70 p-1.5 shadow-sm">
          <button
            type="button"
            aria-pressed={statusTab === "AVAILABLE"}
            onClick={() => setStatusTab("AVAILABLE")}
            className={`min-h-11 rounded-xl px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
              statusTab === "AVAILABLE"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            <span>Ativos</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] sm:text-xs font-bold ${
                statusTab === "AVAILABLE"
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {activeTickets.length}
            </span>
          </button>
          <button
            type="button"
            aria-pressed={statusTab === "USED"}
            onClick={() => setStatusTab("USED")}
            className={`min-h-11 rounded-xl px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
              statusTab === "USED"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            <span>Usados</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] sm:text-xs font-bold ${
                statusTab === "USED"
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {usedTickets.length}
            </span>
          </button>
          <button
            type="button"
            aria-pressed={statusTab === "CANCELED"}
            onClick={() => setStatusTab("CANCELED")}
            className={`min-h-11 rounded-xl px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
              statusTab === "CANCELED"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            <span>Cancelados</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] sm:text-xs font-bold ${
                statusTab === "CANCELED"
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {canceledTickets.length}
            </span>
          </button>
        </div>

        {tickets.isLoading && !tickets.data ? (
          <div className="space-y-5" aria-label="Carregando ingressos">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="overflow-hidden rounded-[24px] border border-violet-500/20 bg-[#151226]/90 backdrop-blur-md sm:rounded-[28px]"
              >
                <div className="grid min-h-[172px] grid-cols-[86px_minmax(0,1fr)_56px] gap-3 p-3 sm:min-h-[194px] sm:grid-cols-[152px_minmax(0,1fr)_88px] sm:gap-5 sm:p-5">
                  <Skeleton className="h-full w-full rounded-2xl bg-white/10" />
                  <div className="space-y-3 py-1">
                    <Skeleton className="h-3 w-2/3 bg-white/10" />
                    <Skeleton className="h-5 w-full bg-white/10" />
                    <Skeleton className="h-4 w-4/5 bg-white/10" />
                    <Skeleton className="mt-5 h-7 w-full bg-white/10" />
                  </div>
                  <div className="border-l border-dashed border-violet-300/20" />
                </div>
              </div>
            ))}
          </div>
        ) : !tickets.data && tickets.isError ? (
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
        ) : (
          <>
            {tickets.isError && (
              <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                <div className="flex items-center gap-2">
                  <CircleAlert className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>
                    {(tickets.error as Error).message ||
                      "Não foi possível atualizar seus ingressos no momento."}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 rounded-lg px-2 text-xs text-rose-200 hover:bg-rose-500/20"
                  onClick={() => tickets.refetch()}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Atualizar
                </Button>
              </div>
            )}

            {displayedTickets.length === 0 ? (
              <div className="relative overflow-hidden rounded-[28px] border border-dashed bg-card px-6 py-16 text-center shadow-sm">
                <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full border-[26px] border-primary/[0.06]" />
                <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10">
                  {statusTab === "AVAILABLE" ? (
                    <Ticket className="h-8 w-8 text-primary" />
                  ) : statusTab === "USED" ? (
                    <Clock className="h-8 w-8 text-violet-400" />
                  ) : (
                    <XCircle className="h-8 w-8 text-rose-500" />
                  )}
                </div>
                <h2 id="ticket-list-title" className="relative text-xl font-bold">
                  {statusTab === "AVAILABLE"
                    ? "Nenhum ingresso ativo"
                    : statusTab === "USED"
                      ? "Nenhum ingresso utilizado"
                      : "Nenhum ingresso cancelado"}
                </h2>
                <p className="relative mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {statusTab === "AVAILABLE"
                    ? "Sua carteira está pronta. Quando uma compra for confirmada, o ingresso aparecerá aqui automaticamente."
                    : statusTab === "USED"
                      ? "Os ingressos que já foram validados na portaria dos eventos aparecerão aqui."
                      : "Ingressos cancelados ou reembolsados aparecerão nesta área."}
                </p>
                {statusTab === "AVAILABLE" && (
                  <Button
                    asChild
                    className="relative mt-6 min-h-11 gap-2 rounded-xl bg-primary text-white hover:bg-primary/90"
                  >
                    <Link href="/">
                      Explorar eventos
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
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
                      {statusTab === "AVAILABLE"
                        ? "Ingressos Ativos"
                        : statusTab === "USED"
                          ? "Ingressos Utilizados"
                          : "Ingressos Cancelados"}
                    </h2>
                  </div>
                  <span className="rounded-full border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
                    {displayedTickets.length}{" "}
                    {displayedTickets.length === 1 ? "ingresso" : "ingressos"}
                  </span>
                </div>

                <div className="stagger-children space-y-5">
                  {displayedTickets.map((ticket) => (
                    <EventTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      expanded={expandedTicket === ticket.id}
                      refundPending={
                        refund.isPending && refund.variables?.ticketId === ticket.id
                      }
                      transferCancelPending={
                        cancelTransfer.isPending
                        && cancelTransfer.variables === ticket.pendingTransfer?.id
                      }
                      onToggleDetails={() =>
                        setExpandedTicket((current) =>
                          current === ticket.id ? null : ticket.id,
                        )
                      }
                      onQrRelease={() => void tickets.refetch()}
                      onDownload={() => void downloadPdf(ticket.id)}
                      walletEnabled={walletConfig.data?.google === true}
                      walletPending={
                        wallet.isPending && wallet.variables === ticket.id
                      }
                      onWallet={() => wallet.mutate(ticket.id)}
                      onTransfer={() => openTransferModal(ticket)}
                      onCancelTransfer={() => {
                        if (ticket.pendingTransfer) {
                          cancelTransfer.mutate(ticket.pendingTransfer.id);
                        }
                      }}
                      onRefund={() => openRefundDialog(ticket)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <Dialog
          open={Boolean(refundTicket)}
          onOpenChange={(open) => !open && closeRefundDialog()}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar cancelamento do ingresso</DialogTitle>
              <DialogDescription>
                Para sua segurança, digite CONFIRMAR antes de solicitar o
                reembolso.
              </DialogDescription>
            </DialogHeader>

            {refundTicket && (
              <div className="rounded-xl border bg-muted/40 p-3 text-sm">
                <p className="font-semibold">{refundTicket.event.title}</p>
                <p className="text-muted-foreground">
                  {refundTicket.ticketType.name} · {refundTicket.attendeeName}
                </p>
              </div>
            )}

            <p className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-relaxed text-amber-950 dark:text-amber-100">
              Esta ação cancela somente este ingresso. Os demais ingressos da
              mesma compra continuarão válidos.
            </p>

            <div className="space-y-2">
              <Label htmlFor="refund-confirmation">
                Digite CONFIRMAR para continuar
              </Label>
              <Input
                id="refund-confirmation"
                value={refundConfirmation}
                onChange={(event) => {
                  setRefundConfirmation(event.target.value.toUpperCase());
                  refund.reset();
                }}
                placeholder="CONFIRMAR"
              />
            </div>

            {refund.isError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {(refund.error as Error).message}
              </p>
            )}

            <Button
              className="w-full rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              disabled={
                !refundTicket ||
                refundConfirmation !== "CONFIRMAR" ||
                refund.isPending
              }
              onClick={() =>
                refundTicket &&
                refund.mutate({
                  ticketId: refundTicket.id,
                  confirmation: refundConfirmation,
                })
              }
            >
              {refund.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Confirmar cancelamento e solicitar reembolso
            </Button>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(transferTicket)}
          onOpenChange={(open) => !open && closeTransferModal()}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Transferir ingresso</DialogTitle>
              <DialogDescription>
                Informe o e-mail do destinatario para iniciar uma
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
              <Label htmlFor="recipient">E-mail do destinatario</Label>
              <div className="flex gap-2">
                <Input
                  id="recipient"
                  type="email"
                  value={recipient}
                  onChange={(event) => {
                    setRecipient(event.target.value);
                    setRecipientLookup(null);
                    resolveRecipient.reset();
                    createTransfer.reset();
                  }}
                  placeholder="destino@email.com"
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

            <div className="space-y-2">
              <Label htmlFor="transfer-confirmation">
                Digite CONFIRMAR para continuar
              </Label>
              <Input
                id="transfer-confirmation"
                value={transferConfirmation}
                onChange={(event) => {
                  setTransferConfirmation(event.target.value.toUpperCase());
                  createTransfer.reset();
                }}
                placeholder="CONFIRMAR"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Confirme o destinatário acima. A transferência será enviada para
                esta pessoa e só poderá ser desfeita antes da aceitação.
              </p>
            </div>

            <Button
              className="w-full rounded-xl"
              disabled={
                !recipientLookup ||
                transferConfirmation !== "CONFIRMAR" ||
                createTransfer.isPending
              }
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

        {cancelTransfer.isError && (
          <div role="alert" className="fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-rose-300/25 bg-[#211823] p-3 text-center text-sm text-rose-200 shadow-xl md:relative md:bottom-auto md:mt-4">
            {(cancelTransfer.error as Error).message}
          </div>
        )}

        {/* Feedbacks */}
        {refund.isSuccess && (
          <div className="fixed bottom-20 left-4 right-4 md:relative md:bottom-auto md:mt-4 rounded-xl bg-brand-purple/10 border border-brand-purple/20 p-3 text-sm text-brand-purple text-center">
            ✓ Cancelamento individual registrado. Sua solicitação de reembolso
            foi enviada.
          </div>
        )}
        {wallet.isError && (
          <div role="alert" className="fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-rose-300/25 bg-[#211823] p-3 text-center text-sm text-rose-200 shadow-xl md:relative md:bottom-auto md:mt-4">
            {(wallet.error as Error).message}
          </div>
        )}
      </div>
    </main>
  );
}
