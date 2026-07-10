"use client";

import Link from "next/link";
import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus, ExternalLink, Pencil, Search, Ticket,
  Copy, XCircle, MoreVertical, Filter, TrendingUp, Clock, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { dateTime, money } from "@/lib/utils";
import type { EventHubEvent, Paginated } from "@/types/eventhub";

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
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (activeTab !== "all") params.set("status", activeTab);
      return api<Paginated<EventHubEvent>>(`/events?${params}`);
    }
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Eventos</h1>
          <p className="text-sm text-muted-foreground">Crie, publique e acompanhe seus eventos.</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/30 self-start">
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
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 border ${
                isActive
                  ? "bg-primary text-white border-primary shadow-sm shadow-primary/20"
                  : "bg-white dark:bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 rounded-xl border-border focus:ring-2 focus:ring-primary/20"
          placeholder="Buscar por nome, cidade ou categoria"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
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
            <div key={event.id} className="group rounded-2xl border bg-white dark:bg-card shadow-sm transition-all duration-200 hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5 overflow-hidden">
              {/* Card Header */}
              <div className="flex items-start justify-between p-5 pb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor[event.status]}`}>
                      {statusLabel[event.status]}
                    </span>
                    {event.category && (
                      <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{event.category}</span>
                    )}
                  </div>
                  <h2 className="text-base font-bold mt-1 truncate">{event.title}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {dateTime(event.startsAt)} &middot; {event.city ?? "Online"}
                  </p>
                </div>

                {/* Dropdown menu */}
                <div className="relative ml-3 shrink-0">
                  <button
                    onClick={() => setOpenMenuId(isMenuOpen ? null : event.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {isMenuOpen && (
                    <div className="absolute right-0 top-9 z-20 min-w-[160px] rounded-xl border bg-white dark:bg-card shadow-lg p-1 animate-scale-in">
                      <Link href={`/events/${event.id}`}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => setOpenMenuId(null)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Link>
                      <button
                        onClick={() => duplicateMutation.mutate(event.id)}
                        disabled={duplicateMutation.isPending}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors">
                        <Copy className="h-3.5 w-3.5" /> Duplicar
                      </button>
                      {event.status !== "CLOSED" && (
                        <button
                          onClick={() => cancelMutation.mutate(event.id)}
                          disabled={cancelMutation.isPending}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                          <XCircle className="h-3.5 w-3.5" /> Cancelar
                        </button>
                      )}
                      {event.status === "PUBLISHED" && (
                        <a href={`/eventos/${event.slug}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={() => setOpenMenuId(null)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Ver pagina
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-3">
                {[
                  { label: "Lotes", value: event.ticketTypes.length, icon: Ticket },
                  { label: "Vendidos", value: totalSold, icon: TrendingUp },
                  { label: "Disponíveis", value: totalAvail, icon: CheckCircle2 },
                  { label: "A partir de", value: money(minPrice), icon: null },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="mt-0.5 font-bold text-sm">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Stock progress bar */}
              {totalQty > 0 && (
                <div className="px-5 pb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Ocupação</span>
                    <span>{stockPct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${stockPct >= 90 ? "bg-rose-500" : stockPct >= 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${stockPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Footer actions */}
              <div className="flex flex-wrap gap-2 border-t bg-muted/30 px-5 py-3">
                <Button variant="outline" size="sm" asChild className="rounded-xl">
                  <Link href={`/events/${event.id}`}><Pencil className="h-3.5 w-3.5" />Editar</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="rounded-xl">
                  <Link href={`/events/${event.id}/tickets`}><Ticket className="h-3.5 w-3.5" />Lotes ({event.ticketTypes.length})</Link>
                </Button>
                {event.status === "PUBLISHED" && (
                  <Button variant="ghost" size="sm" asChild className="rounded-xl">
                    <a href={`/eventos/${event.slug}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />Pagina publica
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
