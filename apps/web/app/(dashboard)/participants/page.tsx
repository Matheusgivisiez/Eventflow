"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, TicketCheck, Users, UserCheck, XCircle,
  Download, ChevronLeft, ChevronRight, QrCode, X, Mail, Calendar, Ticket, Hash
} from "lucide-react";
import QRCodeLib from "qrcode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn, dateTime, money } from "@/lib/utils";
import type { EventHubEvent, Paginated } from "@/types/eventhub";

// ─── Types ───────────────────────────────────────────────────────────────────

type Participant = {
  id: string;
  uuid: string;
  attendeeName: string;
  attendeeEmail: string;
  status: "AVAILABLE" | "USED" | "CANCELED";
  createdAt: string;
  usedAt?: string;
  event: { id: string; title: string; startsAt: string };
  ticketType: { id: string; name: string; priceCents: number };
  order: { id: string; buyerName: string; buyerEmail: string; totalCents: number; createdAt: string };
};

const STATUS_CONFIG = {
  AVAILABLE: { label: "Disponível", variant: "default" as const, icon: TicketCheck, color: "text-emerald-600" },
  USED:      { label: "Utilizado",  variant: "secondary" as const, icon: UserCheck,  color: "text-blue-600" },
  CANCELED:  { label: "Cancelado", variant: "destructive" as const, icon: XCircle,   color: "text-rose-600" },
};

// ─── Debounce Hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState<T>(value);
  useEffect(() => {
    const h = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return dv;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCsv(data: Participant[]) {
  const headers = ["Nome", "E-mail", "Evento", "Lote", "Preço (R$)", "Status", "Data Compra", "Check-in Em"];
  const rows = data.map(p => [
    p.attendeeName,
    p.attendeeEmail,
    p.event.title,
    p.ticketType.name,
    (p.ticketType.priceCents / 100).toFixed(2),
    STATUS_CONFIG[p.status]?.label ?? p.status,
    new Date(p.createdAt).toLocaleString("pt-BR"),
    p.usedAt ? new Date(p.usedAt).toLocaleString("pt-BR") : "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `participantes_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── QR Code Canvas ───────────────────────────────────────────────────────────

function ParticipantQRCode({ participant }: { participant: Participant }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const payload = JSON.stringify({ uuid: participant.uuid, name: participant.attendeeName });
    QRCodeLib.toCanvas(canvasRef.current, payload, {
      width: 200,
      margin: 1,
      color: { dark: "#09090B", light: "#ffffff" },
    });
  }, [participant.uuid, participant.attendeeName]);

  return <canvas ref={canvasRef} className="rounded-xl shadow-sm border" />;
}

// ─── Profile Drawer ───────────────────────────────────────────────────────────

function ProfileDrawer({ participant, onClose }: { participant: Participant | null; onClose: () => void }) {
  if (!participant) return null;
  const cfg = STATUS_CONFIG[participant.status];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-background shadow-2xl border-l animate-in slide-in-from-right duration-300 overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
          <h2 className="font-bold text-lg">Perfil do Participante</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary text-3xl font-bold select-none">
              {participant.attendeeName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold">{participant.attendeeName}</h3>
              <p className="text-sm text-muted-foreground">{participant.attendeeEmail}</p>
            </div>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-muted/50 border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <QrCode className="h-3.5 w-3.5" /> Código de Conexão (Networking)
            </p>
            <ParticipantQRCode participant={participant} />
            <p className="text-xs text-center text-muted-foreground">
              Apresente este QR Code para outros participantes trocarem contato.
            </p>
          </div>

          {/* Info Grid */}
          <div className="space-y-3">
            <InfoRow icon={<Ticket className="h-4 w-4" />} label="Lote" value={participant.ticketType.name} />
            <InfoRow icon={<Hash className="h-4 w-4" />} label="Valor pago" value={money(participant.ticketType.priceCents)} />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Evento" value={participant.event.title} />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Data do evento" value={dateTime(participant.event.startsAt)} />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Comprado em" value={dateTime(participant.createdAt)} />
            {participant.usedAt && (
              <InfoRow icon={<UserCheck className="h-4 w-4" />} label="Check-in em" value={dateTime(participant.usedAt)} />
            )}
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Comprador" value={participant.order.buyerName} />
          </div>

          {/* Contact Button */}
          <Button variant="outline" className="w-full" asChild>
            <a href={`mailto:${participant.attendeeEmail}`}>
              <Mail className="h-4 w-4" /> Enviar e-mail
            </a>
          </Button>
        </div>
      </div>
    </>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PER_PAGE = 20;

export default function ParticipantsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [eventId, setEventId]         = useState("");
  const [status, setStatus]           = useState("");
  const [page, setPage]               = useState(1);
  const [selected, setSelected]       = useState<Participant | null>(null);

  const search = useDebounce(searchInput, 450);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, eventId, status]);

  const params = useMemo(() => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (eventId) q.set("eventId", eventId);
    if (status) q.set("status", status);
    q.set("page", String(page));
    q.set("perPage", String(PER_PAGE));
    return q.toString();
  }, [search, eventId, status, page]);

  const { data: events } = useQuery({
    queryKey: ["events-filter"],
    queryFn: () => api<Paginated<EventHubEvent>>("/events?perPage=100"),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["participants", params],
    queryFn: () => api<Paginated<Participant>>(`/participants?${params}`),
    placeholderData: (prev) => prev,
  });

  // All-participants query for export (no pagination)
  const exportQuery = useQuery({
    queryKey: ["participants-export", eventId, status, search],
    queryFn: () => api<Paginated<Participant>>(`/participants?${new URLSearchParams({ ...(search && { search }), ...(eventId && { eventId }), ...(status && { status }), perPage: "2000" })}`),
    enabled: false,
  });

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    if (result.data?.data) exportCsv(result.data.data);
  };

  const totalPages = data?.meta.totalPages ?? 1;
  const total      = data?.meta.total ?? 0;

  // Stats across current page for KPI summary
  const stats = useMemo(() => {
    const list = data?.data ?? [];
    return {
      available: list.filter(p => p.status === "AVAILABLE").length,
      used:      list.filter(p => p.status === "USED").length,
      canceled:  list.filter(p => p.status === "CANCELED").length,
    };
  }, [data]);

  return (
    <>
      <ProfileDrawer participant={selected} onClose={() => setSelected(null)} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Participantes</h1>
            <p className="text-sm text-muted-foreground mt-1">Consulte ingressos, status de entrada e perfis de networking.</p>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={exportQuery.isFetching} className="gap-2 shadow-sm">
            <Download className="h-4 w-4" />
            {exportQuery.isFetching ? "Exportando..." : "Exportar CSV"}
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard icon={<Users className="h-5 w-5 text-primary" />} label="Total (filtro)" value={total} />
          <KpiCard icon={<TicketCheck className="h-5 w-5 text-emerald-500" />} label="Disponíveis" value={stats.available} color="text-emerald-600" />
          <KpiCard icon={<UserCheck className="h-5 w-5 text-blue-500" />} label="Utilizados" value={stats.used} color="text-blue-600" />
          <KpiCard icon={<XCircle className="h-5 w-5 text-rose-500" />} label="Cancelados" value={stats.canceled} color="text-rose-600" />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_240px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome, e-mail, evento ou lote…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="">Todos os eventos</option>
              {events?.data?.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="AVAILABLE">Disponível</option>
              <option value="USED">Utilizado</option>
              <option value="CANCELED">Cancelado</option>
            </select>
          </CardContent>
        </Card>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Ingressos emitidos</CardTitle>
              <Badge variant="secondary">{total} registros</Badge>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              {data?.data.length === 0 && (
                <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed text-center text-muted-foreground">
                  <TicketCheck className="h-10 w-10 opacity-40" />
                  <p className="mt-3 text-sm">Nenhum participante encontrado.</p>
                </div>
              )}
              {data?.data.map((p) => {
                const cfg = STATUS_CONFIG[p.status];
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="w-full text-left grid gap-3 rounded-xl border p-4 text-sm hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm transition-all duration-150 md:grid-cols-[1.4fr_1fr_130px_130px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm select-none">
                        {p.attendeeName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{p.attendeeName}</p>
                        <p className="text-muted-foreground text-xs truncate">{p.attendeeEmail}</p>
                      </div>
                    </div>
                    <div className="self-center">
                      <p className="font-medium truncate">{p.event.title}</p>
                      <p className="text-muted-foreground text-xs">{p.ticketType.name} · {money(p.ticketType.priceCents)}</p>
                    </div>
                    <div className="self-center">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </div>
                    <div className="self-center text-xs text-muted-foreground">
                      {p.usedAt ? dateTime(p.usedAt) : dateTime(p.createdAt)}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error.message}</p>}
      </div>
    </>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl border bg-white dark:bg-card shadow-sm p-4 flex items-center gap-3">
      <div className="shrink-0 p-2 rounded-xl bg-muted/60">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-xl font-extrabold tracking-tight", color)}>{value.toLocaleString("pt-BR")}</p>
      </div>
    </div>
  );
}
