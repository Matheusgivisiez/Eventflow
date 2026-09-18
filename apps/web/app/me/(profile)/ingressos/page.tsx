"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
  useId,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import {
  Download,
  MapPin,
  RefreshCcw,
  Ticket,
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
  CircleDot,
  Zap,
  Smartphone,
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

type TicketShape = {
  w: number;
  h: number;
  /** vertical: picotado entre conteúdo e canhoto (desktop); horizontal: entre topo e rodapé (celular) */
  mode: "vertical" | "horizontal";
  divider: number;
  radius: number;
  notch: number;
  sideNotch: number;
};

/**
 * Contorno do bilhete com recortes semicirculares. No desktop: meio das
 * laterais + topo/base da linha picotada. No celular: as duas laterais, na
 * altura do picotado horizontal. A borda acompanha cada curva.
 */
function ticketPath({ w, h, mode, divider, radius: r, notch: d, sideNotch: n }: TicketShape) {
  const i = 0.75;
  const L = i;
  const T = i;
  const R = w - i;
  const B = h - i;

  if (mode === "horizontal") {
    return [
      `M ${L + r} ${T}`,
      `H ${R - r}`,
      `A ${r} ${r} 0 0 1 ${R} ${T + r}`,
      `V ${divider - d}`,
      `A ${d} ${d} 0 0 0 ${R} ${divider + d}`,
      `V ${B - r}`,
      `A ${r} ${r} 0 0 1 ${R - r} ${B}`,
      `H ${L + r}`,
      `A ${r} ${r} 0 0 1 ${L} ${B - r}`,
      `V ${divider + d}`,
      `A ${d} ${d} 0 0 0 ${L} ${divider - d}`,
      `V ${T + r}`,
      `A ${r} ${r} 0 0 1 ${L + r} ${T}`,
      "Z",
    ].join(" ");
  }

  const cy = h / 2;
  return [
    `M ${L + r} ${T}`,
    `H ${divider - d}`,
    `A ${d} ${d} 0 0 0 ${divider + d} ${T}`,
    `H ${R - r}`,
    `A ${r} ${r} 0 0 1 ${R} ${T + r}`,
    `V ${cy - n}`,
    `A ${n} ${n} 0 0 0 ${R} ${cy + n}`,
    `V ${B - r}`,
    `A ${r} ${r} 0 0 1 ${R - r} ${B}`,
    `H ${divider + d}`,
    `A ${d} ${d} 0 0 0 ${divider - d} ${B}`,
    `H ${L + r}`,
    `A ${r} ${r} 0 0 1 ${L} ${B - r}`,
    `V ${cy + n}`,
    `A ${n} ${n} 0 0 0 ${L} ${cy - n}`,
    `V ${T + r}`,
    `A ${r} ${r} 0 0 1 ${L + r} ${T}`,
    "Z",
  ].join(" ");
}

function useTicketShape() {
  const ticketRef = useRef<HTMLButtonElement>(null);
  const stubRef = useRef<HTMLSpanElement>(null);
  const holderRef = useRef<HTMLSpanElement>(null);
  const [shape, setShape] = useState<TicketShape | null>(null);

  useLayoutEffect(() => {
    const ticket = ticketRef.current;
    const stub = stubRef.current;
    const holder = holderRef.current;
    if (!ticket || !stub || !holder) return;

    const update = () => {
      const desktop = window.matchMedia("(min-width: 640px)").matches;
      setShape({
        w: ticket.offsetWidth,
        h: ticket.offsetHeight,
        mode: desktop ? "vertical" : "horizontal",
        divider: desktop ? stub.offsetLeft : holder.offsetTop,
        radius: desktop ? 22 : 20,
        notch: desktop ? 10 : 11,
        sideNotch: desktop ? 12 : 11,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(ticket);
    return () => observer.disconnect();
  }, []);

  return { ticketRef, stubRef, holderRef, shape };
}

/** Separa um sufixo entre colchetes do título, ex.: "Show [DADOS DEMONSTRATIVOS]". */
function splitEventTitle(title: string): [string, string | null] {
  const match = title.match(/^(.*?)\s*(\[[^\]]+\])\s*$/);
  return match ? [match[1], match[2]] : [title, null];
}

function QrGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="5.75" y="5.75" width="2.5" height="2.5" rx="0.5" />
      <rect x="15.75" y="5.75" width="2.5" height="2.5" rx="0.5" />
      <rect x="5.75" y="15.75" width="2.5" height="2.5" rx="0.5" />
      <rect x="13" y="13" width="3" height="3" rx="0.6" />
      <rect x="18" y="13" width="3" height="3" rx="0.6" />
      <rect x="15.5" y="15.5" width="3" height="3" rx="0.6" />
      <rect x="13" y="18" width="3" height="3" rx="0.6" />
      <rect x="18" y="18" width="3" height="3" rx="0.6" />
    </svg>
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
  const { ticketRef, stubRef, holderRef, shape } = useTicketShape();
  const [titleMain, titleTag] = splitEventTitle(ticket.event.title);
  const gradientId = `ticket-${useId().replace(/:/g, "")}`;
  const stubLabel =
    qrLocked && qrHoursRemaining !== null
      ? `Libera em ${qrHoursRemaining}h`
      : canOpenQr
        ? "Escaneie para entrar"
        : "QR indisponível";

  return (
    <article className="group mx-1 animate-slide-up">
      <div className="relative">
        <button
          ref={ticketRef}
          type="button"
          aria-controls={detailsPanelId}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Recolher" : "Abrir"} ingresso de ${ticket.event.title}`}
          onClick={onToggleDetails}
          className={`relative isolate z-10 grid grid-cols-[104px_minmax(0,1fr)_auto] rounded-[22px] text-left text-[#f7f5ff] transition-[margin,width] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/70 sm:min-h-[216px] sm:grid-cols-[172px_minmax(0,1fr)_160px] sm:grid-rows-[1fr_auto] ${
            expanded
              ? "mx-2.5 w-[calc(100%-20px)] sm:mx-6 sm:w-[calc(100%-48px)]"
              : "w-full"
          } ${shape ? "" : "border border-violet-400/40 bg-[#17142a]"}`}
        >
          {shape && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-visible drop-shadow-[0_0_22px_rgba(139,92,246,0.18)]"
              width={shape.w}
              height={shape.h}
              viewBox={`0 0 ${shape.w} ${shape.h}`}
            >
              <defs>
                <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#1d1930" />
                  <stop offset="55%" stopColor="#16131f" />
                  <stop offset="100%" stopColor="#12101b" />
                </linearGradient>
                <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.5" />
                </linearGradient>
              </defs>
              <path
                d={ticketPath(shape)}
                fill={`url(#${gradientId}-fill)`}
                stroke={`url(#${gradientId}-stroke)`}
                strokeWidth="1.5"
              />
              {shape.mode === "vertical" ? (
                <line
                  x1={shape.divider}
                  y1={shape.notch + 8}
                  x2={shape.divider}
                  y2={shape.h - shape.notch - 8}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1.2"
                  strokeDasharray="4 5"
                />
              ) : (
                <line
                  x1={shape.notch + 8}
                  y1={shape.divider}
                  x2={shape.w - shape.notch - 8}
                  y2={shape.divider}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1.2"
                  strokeDasharray="4 5"
                />
              )}
            </svg>
          )}

          {/* capa */}
          <span className="relative col-start-1 row-start-1 m-3 min-h-[124px] overflow-hidden rounded-[12px] border border-white/10 bg-[#211c38] shadow-[0_12px_30px_rgba(0,0,0,0.45)] sm:row-span-2 sm:m-4 sm:min-h-0 sm:rounded-[16px]">
            {bannerUrl ? (
              <Image
                src={bannerUrl}
                alt={`Capa do evento ${ticket.event.title}`}
                fill
                sizes="(min-width: 640px) 140px, 80px"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-900/60 to-[#211c38]">
                <Ticket className="h-8 w-8 text-violet-300/70 sm:h-11 sm:w-11" />
              </span>
            )}
          </span>

          {/* dados do evento */}
          <span className="col-span-2 col-start-2 row-start-1 flex min-w-0 flex-col py-3.5 pr-4 sm:col-span-1 sm:pb-2 sm:pl-2 sm:pr-6 sm:pt-4">
            <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/75 sm:gap-2 sm:text-[12px] sm:tracking-[0.14em]">
                <Calendar className="h-3.5 w-3.5 text-white/70 sm:h-4 sm:w-4" strokeWidth={1.75} />
                <span>{schedule.weekday}</span>
                <span className="text-white/35">·</span>
                <span>{schedule.dayAndMonth}</span>
                <span className="text-white/35">·</span>
                <span>{schedule.time}</span>
              </span>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[9px] font-semibold uppercase tracking-[0.14em] sm:px-3 sm:py-1 sm:text-[10px] sm:tracking-[0.16em] ${
                  ticket.status === "AVAILABLE"
                    ? "border-violet-400/25 bg-violet-500/[0.08] text-violet-300"
                    : cfg.color
                }`}
              >
                <TopBadgeIcon className="h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" />
                {topBadgeLabel}
              </span>
            </span>

            <h3 className="mt-2 line-clamp-3 text-[16px] font-medium leading-[1.22] tracking-[-0.01em] text-white sm:mt-2.5 sm:line-clamp-2 sm:text-[21px]">
              {titleMain}
              {titleTag && (
                <>
                  {" "}
                  <span className="text-[0.8em] font-normal tracking-[0.01em] text-white/80">
                    {titleTag}
                  </span>
                </>
              )}
            </h3>

            <span className="mt-2 flex min-w-0 items-start gap-1.5 text-[11.5px] leading-snug text-white/60 sm:gap-2 sm:text-[13px]">
              <MapPin className="mt-px h-3.5 w-3.5 shrink-0 text-violet-300 sm:h-4 sm:w-4" strokeWidth={1.75} />
              <span className="line-clamp-2">{eventLocation(ticket)}</span>
            </span>

            {pendingTransfer && (
              <span className="mt-2 flex max-w-full items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-2 py-1.5 text-[10px] font-semibold text-amber-100 sm:text-xs">
                <Clock className="h-3 w-3 shrink-0 text-amber-300" />
                <span className="truncate">Aguardando aceite de {pendingRecipient}</span>
              </span>
            )}
          </span>

          {/* titular + badges (no celular fica abaixo do picotado) */}
          <span
            ref={holderRef}
            className="col-span-2 col-start-1 row-start-2 flex min-w-0 flex-col justify-center py-3.5 pl-4 pr-2 sm:col-span-1 sm:col-start-2 sm:block sm:py-0 sm:pb-4 sm:pl-2 sm:pr-6"
          >
            <span className="block sm:flex sm:items-end sm:justify-between sm:gap-4 sm:border-t sm:border-white/10 sm:pt-3">
              <span className="block min-w-0">
                <span className="block text-[9px] font-medium uppercase tracking-[0.2em] text-white/45 sm:text-[10px]">
                  Titular
                </span>
                <span className="mt-0.5 block truncate text-[14px] font-semibold text-white sm:mt-1 sm:text-[15px]">
                  {ticket.attendeeName}
                </span>
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-0 sm:shrink-0 sm:flex-nowrap sm:justify-end sm:gap-2">
                <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-violet-400/35 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-white/90 sm:px-3 sm:py-1.5 sm:text-[12px]">
                  <Ticket className="h-3.5 w-3.5 shrink-0 text-violet-300" strokeWidth={1.75} />
                  {ticket.ticketType.name}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:px-3 sm:py-1.5 sm:text-[12px] ${
                    ticket.status === "AVAILABLE"
                      ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                      : cfg.color
                  }`}
                >
                  {ticket.status === "AVAILABLE" ? (
                    <CircleDot className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    <StatusIcon className="h-3.5 w-3.5" />
                  )}
                  {cfg.label}
                </span>
              </span>
            </span>
          </span>

          {/* canhoto do QR */}
          <span
            ref={stubRef}
            className="relative col-start-3 row-start-2 flex flex-col items-center justify-center gap-1.5 py-3.5 pl-2 pr-4 text-center sm:row-span-2 sm:row-start-1 sm:justify-between sm:gap-0 sm:px-4 sm:py-4"
          >
            <span className="hidden text-[11px] font-medium uppercase tracking-[0.22em] text-white/80 sm:block">
              QR entrada
            </span>
            <span className="flex h-14 w-14 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:h-[80px] sm:w-[80px] sm:rounded-[18px]">
              {qrLocked ? (
                <Lock className="h-6 w-6 text-white/80 sm:h-7 sm:w-7" strokeWidth={1.75} />
              ) : (
                <QrGlyph className="h-7 w-7 text-white sm:h-[40px] sm:w-[40px]" />
              )}
            </span>
            <span className="max-w-[72px] text-[8px] font-normal uppercase leading-snug tracking-[0.14em] text-white/55 sm:max-w-[120px] sm:text-[9px] sm:leading-relaxed sm:tracking-[0.2em]">
              <span className="sm:hidden">
                {qrLocked && qrHoursRemaining !== null
                  ? `Libera em ${qrHoursRemaining}h`
                  : canOpenQr
                    ? "Toque p/ abrir"
                    : "Indisponível"}
              </span>
              <span className="hidden sm:inline">{stubLabel}</span>
            </span>
            <span className="hidden w-full flex-col items-center gap-2.5 sm:flex">
              <span className="h-px w-4/5 bg-white/10" />
              <span className="inline-flex items-center gap-2">
                <Zap className="h-4 w-4 fill-violet-500 text-violet-500" />
                <span className="text-[9px] font-medium uppercase tracking-[0.26em] text-white/60">
                  Event Flow
                </span>
              </span>
            </span>
          </span>
        </button>

        {expanded && (
          <div
            id={detailsPanelId}
            className="relative -mt-8 animate-slide-up overflow-hidden rounded-[26px] border border-violet-400/25 bg-[#13101d] shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:-mt-11 sm:rounded-[30px]"
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {bannerUrl && (
                <Image
                  src={bannerUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 1024px, 100vw"
                  className="scale-110 object-cover opacity-25 blur-md saturate-150"
                />
              )}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(124,58,237,0.22),transparent_60%)]" />
              <div className="absolute inset-0 bg-gradient-to-b from-[#13101d] via-[#13101d]/55 to-[#13101d]" />
            </div>

            <div className="relative px-4 pb-4 pt-12 sm:px-7 sm:pb-5 sm:pt-[62px]">
              <div className="lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-6">
                <div className="hidden text-[11px] font-medium uppercase leading-[1.8] tracking-[0.3em] text-white/75 lg:block">
                  A música
                  <br />
                  nos conecta
                  <span className="mt-3 block h-[3px] w-7 rounded-full bg-violet-500" />
                </div>

                <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                  {canOpenQr && (
                    <>
                      <div className="rounded-[22px] bg-white p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] sm:p-4">
                        <Image
                          src={ticket.qrCodeDataUrl!}
                          alt={`QR Code do ingresso para ${ticket.event.title}`}
                          width={176}
                          height={176}
                          unoptimized
                          className="h-40 w-40 sm:h-44 sm:w-44"
                        />
                      </div>
                      <p className="mt-3.5 pl-[0.4em] text-base font-semibold tracking-[0.4em] text-white sm:text-lg">
                        {ticket.uuid?.slice(0, 8).toUpperCase() ?? "--------"}
                      </p>
                      <p className="mt-2 max-w-xs text-xs leading-relaxed text-white/60 sm:text-sm">
                        Apresente este código na entrada. Evite compartilhar a tela
                        com outras pessoas.
                      </p>
                    </>
                  )}

                  {ticket.status === "AVAILABLE" && !canOpenQr && (
                    <div className="flex h-40 w-40 flex-col items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.04] px-4 sm:h-44 sm:w-44">
                      <Lock className="h-10 w-10 text-violet-300" strokeWidth={1.75} />
                      <p className="mt-3 text-sm font-semibold text-white">QR Code bloqueado</p>
                      <p className="mt-1 text-xs leading-relaxed text-white/55">
                        {qrHoursRemaining !== null
                          ? `Libera em ${qrHoursRemaining}h, perto do horário do evento.`
                          : "Libera perto do horário do evento."}
                      </p>
                    </div>
                  )}

                  {ticket.status === "USED" && (
                    <div className="flex w-full flex-col items-center rounded-[22px] border border-violet-500/30 bg-violet-500/10 p-6">
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
                  )}

                  {ticket.status === "CANCELED" && (
                    <div className="flex w-full flex-col items-center rounded-[22px] border border-rose-500/30 bg-rose-500/10 p-6">
                      <XCircle className="mb-2 h-10 w-10 text-rose-400" />
                      <h4 className="text-base font-bold text-rose-200">Ingresso cancelado</h4>
                      <p className="mt-1 text-xs text-white/60">
                        Este ingresso foi cancelado ou reembolsado e não pode mais ser utilizado.
                      </p>
                    </div>
                  )}
                </div>

                <div className="hidden justify-self-end text-[11px] font-medium uppercase leading-[1.8] tracking-[0.3em] text-white/75 lg:block">
                  Event Flow
                  <br />
                  sempre com você
                  <span className="mt-3 block h-[3px] w-7 rounded-full bg-violet-500" />
                </div>
              </div>

              <div className="mt-5 border-t border-dashed border-white/15 pt-4 sm:mt-5 sm:pt-5">
                <div className="flex flex-wrap gap-2.5 sm:flex-nowrap sm:gap-3">
                  <Button
                    variant="outline"
                    className="h-12 flex-1 basis-full gap-2.5 rounded-xl border border-violet-400/40 bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] text-sm font-semibold text-white shadow-[0_10px_30px_rgba(124,58,237,0.35)] hover:text-white hover:brightness-110 sm:h-12 sm:basis-0 sm:text-[15px]"
                    disabled={ticket.status === "CANCELED" || qrLocked}
                    onClick={onDownload}
                    title={qrLocked ? "QR Code bloqueado — aguarde a liberação" : undefined}
                  >
                    <Download className="h-5 w-5" strokeWidth={1.75} />
                    Baixar ingresso
                  </Button>

                  {ticket.status === "AVAILABLE" && pendingTransfer ? (
                    <Button
                      variant="outline"
                      className="h-12 flex-1 gap-2.5 rounded-xl border-amber-300/25 bg-amber-300/10 text-sm text-amber-100 hover:bg-amber-300/20 hover:text-amber-50 sm:h-12 sm:text-[15px]"
                      disabled={transferCancelPending}
                      onClick={onCancelTransfer}
                    >
                      {transferCancelPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <XCircle className="h-5 w-5" strokeWidth={1.75} />
                      )}
                      Cancelar transferência
                    </Button>
                  ) : ticket.status === "AVAILABLE" ? (
                    <Button
                      variant="outline"
                      className="h-12 flex-1 gap-2.5 rounded-xl border-white/15 bg-white/[0.04] text-sm font-semibold text-white backdrop-blur hover:bg-white/10 hover:text-white sm:h-12 sm:text-[15px]"
                      disabled={transferLocked}
                      onClick={onTransfer}
                      title={transferReason ?? undefined}
                    >
                      {transferLocked ? (
                        <Lock className="h-5 w-5" strokeWidth={1.75} />
                      ) : (
                        <Send className="h-5 w-5" strokeWidth={1.75} />
                      )}
                      Transferir
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="h-12 flex-1 rounded-xl border-white/10 bg-white/[0.03] text-sm text-white/35 sm:h-12"
                      disabled
                    >
                      Transferência indisponível
                    </Button>
                  )}

                  {walletEnabled && ticket.status === "AVAILABLE" && (
                    <Button
                      variant="outline"
                      aria-label="Adicionar ao Google Wallet"
                      className="h-12 w-14 shrink-0 rounded-xl border-white/15 bg-white/[0.04] p-0 text-white backdrop-blur hover:bg-white/10 hover:text-white sm:h-12 sm:w-16"
                      disabled={qrLocked || walletPending}
                      onClick={onWallet}
                      title={
                        qrLocked
                          ? "Disponível quando o QR Code for liberado"
                          : "Adicionar ao Google Wallet"
                      }
                    >
                      {walletPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Smartphone className="h-5 w-5" strokeWidth={1.75} />
                      )}
                    </Button>
                  )}
                </div>

                {ticket.status === "AVAILABLE" && ticket.refundAvailable && (
                  <div className="mt-4 flex items-center gap-4 sm:mt-5">
                    <span className="h-px flex-1 bg-white/10" />
                    <button
                      type="button"
                      className="flex min-h-11 flex-col items-center justify-center text-sm text-white/55 transition-colors hover:text-rose-200 disabled:opacity-50"
                      disabled={refundPending || Boolean(pendingTransfer)}
                      onClick={onRefund}
                      title={pendingTransfer ? "Cancele a transferência pendente antes de solicitar reembolso" : undefined}
                    >
                      <span className="flex items-center gap-2">
                        <RefreshCcw className="h-4 w-4" strokeWidth={1.75} />
                        Solicitar reembolso
                      </span>
                      {ticket.refundDeadline && (
                        <span className="text-[11px] text-white/35">
                          Disponível até {dateTime(ticket.refundDeadline)}
                        </span>
                      )}
                    </button>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                )}
                {ticket.status === "AVAILABLE" && !ticket.refundAvailable && ticket.refundBlockedReason && (
                  <p className="mt-4 flex min-h-11 items-center justify-center text-center text-xs text-white/35 sm:mt-5">
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
