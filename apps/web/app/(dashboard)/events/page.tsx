"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus, ExternalLink, Pencil, Search, Ticket,
  Copy, XCircle, MoreVertical, Filter, TrendingUp, Clock, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { api } from "@/lib/api";
import { cn, dateTime, money } from "@/lib/utils";
import type { EventFlowEvent, Paginated } from "@/types/eventflow";

const STATUS_TABS = [
  { key: "all", label: "Todos", icon: Filter },
  { key: "PUBLISHED", label: "Publicados", icon: CheckCircle2 },
  { key: "DRAFT", label: "Rascunhos", icon: Clock },
  { key: "CLOSED", label: "Encerrados", icon: XCircle },
] as const;

const statusLabel: Record<string, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicado", CLOSED: "Encerrado" };
const statusColor: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/40",
  PUBLISHED: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/40",
  CLOSED: "bg-muted text-muted-foreground border-border"
};

export default function EventsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "PUBLISHED" | "DRAFT" | "CLOSED">("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const qc = useQueryClient();

  // Debounce: only triggers query after user stops typing for 350ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", debouncedSearch, activeTab],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("summary", "1");
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (activeTab !== "all") params.set("status", activeTab);
      return api<Paginated<EventFlowEvent>>(`/events?${params}`);
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: false
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api(`/events/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); setOpenMenuId(null); }
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api(`/events/${id}/cancel`, { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); setOpenMenuId(null); }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Eventos</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Crie, publique e acompanhe seus eventos.</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/30 rounded-xl font-semibold self-start sm:self-auto">
          <Link href="/events/new"><CalendarPlus className="h-4 w-4" />Novo evento</Link>
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 border ${
                isActive
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]"
                  : "bg-white/60 dark:bg-card/60 backdrop-blur-md border-border text-muted-foreground hover:border-primary/40 hover:bg-white dark:hover:bg-card hover:text-primary hover:shadow-sm"
              }`}
            >
              <Icon className={cn("h-4 w-4", isActive ? "animate-pulse-soft" : "")} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md group">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <Input
          className="pl-10 h-11 rounded-xl border-border/60 bg-white/50 dark:bg-card/50 backdrop-blur-sm transition-all duration-300 focus:bg-white dark:focus:bg-card focus:border-primary/50 focus:ring-4 focus:ring-primary/10 shadow-sm"
          placeholder="Buscar por nome, cidade ou categoria"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-44 w-full rounded-2xl skeleton-shimmer glass-premium" />)}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </p>
      )}

      {/* Empty */}
      {!isLoading && data?.data.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white dark:bg-card p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <CalendarPlus className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold">Nenhum evento encontrado</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            {activeTab !== "all" ? "Nenhum evento nesta categoria." : "Comece criando seu primeiro evento."}
          </p>
          <Button asChild className="mt-6 bg-primary hover:bg-primary/90 text-white">
            <Link href="/events/new"><CalendarPlus className="h-4 w-4" />Criar evento</Link>
          </Button>
        </div>
      )}

      {/* Event Cards */}
      <div className="space-y-4 stagger-children">
        {data?.data.map((event) => {
          const totalSold = event.ticketTypes.reduce((s, t) => s + t.sold, 0);
          const totalQty = event.ticketTypes.reduce((s, t) => s + t.quantity, 0);
          const totalAvail = totalQty - totalSold;
          const minPrice = event.ticketTypes.length ? Math.min(...event.ticketTypes.map((t) => t.priceCents)) : 0;
          const stockPct = totalQty > 0 ? Math.round((totalSold / totalQty) * 100) : 0;
          const isMenuOpen = openMenuId === event.id;

          return (
            <div key={event.id} className="group rounded-2xl glass-premium shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 overflow-hidden">
              {/* Card Header */}
              <div className="flex items-start justify-between p-6 pb-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${statusColor[event.status]}`}>
                      {statusLabel[event.status]}
                    </span>
                    {event.category && (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 border border-border/50 rounded-full px-2.5 py-0.5">{event.category}</span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold mt-1 truncate text-foreground group-hover:text-primary transition-colors">{event.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1 font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> {dateTime(event.startsAt)} <span className="mx-1">•</span> {event.city ?? "Online"}
                  </p>
                </div>

                {/* Dropdown menu */}
                <div className="relative ml-4 shrink-0">
                  <button
                    onClick={() => setOpenMenuId(isMenuOpen ? null : event.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground hover:bg-muted/80 hover:border-border/50 hover:text-foreground transition-all duration-200"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {isMenuOpen && (
                    <div className="absolute right-0 top-11 z-20 min-w-[180px] rounded-2xl border border-border/50 bg-white/95 dark:bg-card/95 backdrop-blur-xl shadow-2xl p-1.5 animate-scale-in origin-top-right">
                      <Link href={`/events/${event.id}`}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                        onClick={() => setOpenMenuId(null)}>
                        <Pencil className="h-4 w-4" /> Editar
                      </Link>
                      <button
                        onClick={() => duplicateMutation.mutate(event.id)}
                        disabled={duplicateMutation.isPending}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
                        <Copy className="h-4 w-4" /> Duplicar
                      </button>
                      {event.status !== "CLOSED" && (
                        <div className="border-t border-border/50 mt-1 pt-1">
                          <button
                            onClick={() => cancelMutation.mutate(event.id)}
                            disabled={cancelMutation.isPending}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                            <XCircle className="h-4 w-4" /> Cancelar
                          </button>
                        </div>
                      )}
                      {event.status === "PUBLISHED" && (
                        <div className="border-t border-border/50 mt-1 pt-1">
                          <a href={`/eventos/${event.slug}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                            onClick={() => setOpenMenuId(null)}>
                            <ExternalLink className="h-4 w-4" /> Ver página
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4">
                {[
                  { label: "Lotes", value: event.ticketTypes.length, icon: Ticket },
                  { label: "Vendidos", value: totalSold, icon: TrendingUp },
                  { label: "Disponíveis", value: totalAvail, icon: CheckCircle2 },
                  { label: "A partir de", value: money(minPrice), icon: null },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl bg-white/40 dark:bg-black/20 border border-border/40 p-3.5 transition-colors hover:bg-white/60 dark:hover:bg-black/40">
                    <p className="text-xs text-muted-foreground font-medium">{m.label}</p>
                    <p className="mt-1 font-bold text-base text-foreground">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Stock progress bar */}
              {totalQty > 0 && (
                <div className="px-6 pb-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-2">
                    <span>Ocupação Total</span>
                    <span>{stockPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/60 overflow-hidden border border-border/30">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${stockPct >= 90 ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" : stockPct >= 60 ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"}`}
                      style={{ width: `${stockPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Footer actions */}
              <div className="flex flex-wrap gap-3 border-t border-border/50 bg-muted/20 px-6 py-4">
                <Button variant="outline" size="sm" asChild className="rounded-xl font-semibold bg-white/50 dark:bg-card/50 hover:bg-white dark:hover:bg-card shadow-sm">
                  <Link href={`/events/${event.id}`}><Pencil className="h-4 w-4" />Editar Detalhes</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="rounded-xl font-semibold bg-white/50 dark:bg-card/50 hover:bg-white dark:hover:bg-card shadow-sm">
                  <Link href={`/events/${event.id}/tickets`}><Ticket className="h-4 w-4" />Gerenciar Lotes ({event.ticketTypes.length})</Link>
                </Button>
                {event.status === "PUBLISHED" && (
                  <Button variant="ghost" size="sm" asChild className="rounded-xl font-semibold text-primary hover:text-primary hover:bg-primary/10">
                    <a href={`/eventos/${event.slug}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />Página Pública
                    </a>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
