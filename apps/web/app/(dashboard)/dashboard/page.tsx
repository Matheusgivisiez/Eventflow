"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import Link from "next/link";
import {
  Activity, ArrowUpRight, ArrowDownRight, CalendarCheck,
  CircleDollarSign, TicketCheck, Users, TrendingUp,
  CalendarDays, MapPin, Monitor, CheckCircle2, Clock,
  ExternalLink, Zap
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, BarChart, Bar, Cell
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { money, dateTime } from "@/lib/utils";

type TopEvent = {
  id: string; title: string; status: string; startsAt: string;
  revenueCents: number; ticketsSold: number; checkIns: number;
};
type UpcomingEvent = {
  id: string; title: string; startsAt: string; city: string | null; format: "ONLINE" | "IN_PERSON";
};
type Dashboard = {
  totalRevenueCents: number; totalFeesCents: number; ticketsSold: number;
  activeEvents: number; closedEvents: number; paidOrders: number;
  pendingOrders: number; checkIns: number; visitorsEstimate: number; conversionRate: number;
  weeklyRevenueCents: number; weeklyRevenueGrowthPct: number;
  weeklyTickets: number; weeklyTicketsGrowthPct: number;
  monthlyRevenueCents: number; monthlyRevenueGrowthPct: number;
  newBuyersThisWeek: number; newBuyersGrowthPct: number;
  revenueByMonth: { month: string; totalCents: number }[];
  topEvents: TopEvent[];
  upcomingEvents: UpcomingEvent[];
};

function GrowthBadge({ pct }: { pct: number }) {
  const positive = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${positive ? "text-emerald-500" : "text-rose-500"}`}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

const statusLabel: Record<string, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicado", CLOSED: "Encerrado" };
const statusColor: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PUBLISHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  CLOSED: "bg-muted text-muted-foreground"
};

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-white dark:bg-card shadow-xl p-3 text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-primary font-bold">{money(payload[0].value)}</p>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, iconClass, growth, growthLabel, sub }: {
  label: string; value: string; icon: React.ElementType; iconClass: string;
  growth?: number; growthLabel?: string; sub?: string;
}) {
  return (
    <div className="group rounded-2xl border bg-white dark:bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        {growth !== undefined && <GrowthBadge pct={growth} />}
      </div>
      <p className="text-2xl font-extrabold tracking-tight text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5 font-medium">{label}</p>
      {growthLabel && <p className="text-xs text-muted-foreground mt-1.5">{growthLabel}</p>}
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-36 rounded-2xl bg-muted" />)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-2xl bg-muted" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="h-80 rounded-2xl bg-muted" />
        <div className="h-80 rounded-2xl bg-muted" />
      </div>
      <div className="h-64 rounded-2xl bg-muted" />
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/dashboard"),
    refetchInterval: 60_000
  });

  if (isLoading) return <DashboardSkeleton />;
  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive flex items-center gap-3">
        <Activity className="h-5 w-5 shrink-0" />
        {(error as Error).message}
      </div>
    );
  }

  // Memoized: these values only change when `data` itself changes
  const netRevenue = useMemo(() => (data?.totalRevenueCents ?? 0) - (data?.totalFeesCents ?? 0), [data]);
  const checkInRate = useMemo(() => data?.ticketsSold ? Math.round(((data.checkIns ?? 0) / data.ticketsSold) * 100) : 0, [data]);
  const chartData = useMemo(() => (data?.revenueByMonth ?? []).slice(-6).map((item) => ({
    month: item.month.slice(5),
    totalCents: item.totalCents
  })), [data]);
  const barColors = ["#5b3dff", "#a855f7", "#ec4899", "#6366f1", "#8b5cf6"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visao geral dos seus eventos e vendas em tempo real.</p>
        </div>
        <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/30 self-start">
          <Link href="/events/new"><Zap className="h-4 w-4" />Novo evento</Link>
        </Button>
      </div>

      {/* Primary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
        <KpiCard label="Receita total" value={money(data?.totalRevenueCents)} icon={CircleDollarSign}
          iconClass="bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20"
          growth={data?.monthlyRevenueGrowthPct} growthLabel="vs. mes anterior" />
        <KpiCard label="Ingressos vendidos" value={String(data?.ticketsSold ?? 0)} icon={TicketCheck}
          iconClass="bg-brand-violet/10 text-brand-violet dark:bg-brand-violet/20"
          growth={data?.weeklyTicketsGrowthPct} growthLabel="vs. semana passada" />
        <KpiCard label="Eventos ativos" value={String(data?.activeEvents ?? 0)} icon={Activity}
          iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          sub={`${data?.closedEvents ?? 0} encerrados`} />
        <KpiCard label="Check-ins realizados" value={String(data?.checkIns ?? 0)} icon={CheckCircle2}
          iconClass="bg-brand-pink/10 text-brand-pink dark:bg-brand-pink/20"
          sub={`Taxa de entrada: ${checkInRate}%`} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
        <KpiCard label="Receita esta semana" value={money(data?.weeklyRevenueCents)} icon={TrendingUp}
          iconClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
          growth={data?.weeklyRevenueGrowthPct} growthLabel="vs. semana passada" />
        <KpiCard label="Novos compradores" value={String(data?.newBuyersThisWeek ?? 0)} icon={Users}
          iconClass="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400"
          growth={data?.newBuyersGrowthPct} growthLabel="esta semana" />
        <KpiCard label="Pedidos pendentes" value={String(data?.pendingOrders ?? 0)} icon={Clock}
          iconClass="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          sub="Aguardando pagamento" />
        <KpiCard label="Taxa de conversao" value={`${data?.conversionRate ?? 0}%`} icon={CalendarCheck}
          iconClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          sub={`${data?.visitorsEstimate ?? 0} visitantes estimados`} />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border bg-white dark:bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-base">Receita por mes</h2>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">Ultimos 6 meses</span>
          </div>
          <p className="text-xs text-muted-foreground mb-5">Pagamentos confirmados no periodo.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(249 100% 62%)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="hsl(249 100% 62%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `R$${(Number(v) / 100).toLocaleString("pt-BR", { notation: "compact" })}`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={60} axisLine={false} tickLine={false} />
                <Tooltip content={<RevenueTooltip />} />
                <Area type="monotone" dataKey="totalCents" stroke="hsl(249 100% 62%)" strokeWidth={2.5}
                  fill="url(#revenueGrad)"
                  dot={{ r: 4, fill: "hsl(249 100% 62%)", strokeWidth: 2, stroke: "white" }}
                  activeDot={{ r: 6, fill: "hsl(249 100% 62%)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-white dark:bg-card p-5 shadow-sm flex flex-col">
          <h2 className="font-bold text-base mb-1">Resumo financeiro</h2>
          <p className="text-xs text-muted-foreground mb-5">Consolidado geral de receitas.</p>
          <div className="space-y-2.5 flex-1">
            {[
              { label: "Pedidos pagos", value: String(data?.paidOrders ?? 0) },
              { label: "Receita bruta", value: money(data?.totalRevenueCents), highlight: true },
              { label: "Taxas da plataforma", value: `-\u00a0${money(data?.totalFeesCents)}`, negative: true },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className={`font-semibold ${row.highlight ? "text-primary" : row.negative ? "text-rose-500" : ""}`}>{row.value}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-4 pt-4">
            <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/15 px-3 py-3">
              <span className="text-sm font-semibold">Receita liquida</span>
              <span className="text-lg font-extrabold text-primary">{money(netRevenue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Events */}
      {(data?.topEvents ?? []).length > 0 && (
        <div className="rounded-2xl border bg-white dark:bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <h2 className="font-bold text-base">Top eventos por receita</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Seus eventos com maior arrecadacao.</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/events">Ver todos <ExternalLink className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <div className="px-5 pt-4 pb-1 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topEvents ?? []} barCategoryGap="30%" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="title" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                  interval={0} tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + "..." : v} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => [money(v), "Receita"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="revenueCents" radius={[6, 6, 0, 0]}>
                  {(data?.topEvents ?? []).map((_, i) => <Cell key={i} fill={barColors[i % barColors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t bg-muted/40">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Evento</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Status</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Ingressos</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Check-ins</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground">Receita</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topEvents ?? []).map((ev) => (
                  <tr key={ev.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/events/${ev.id}`} className="font-medium hover:text-primary transition-colors line-clamp-1">{ev.title}</Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{dateTime(ev.startsAt)}</p>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[ev.status]}`}>
                        {statusLabel[ev.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">{ev.ticketsSold}</td>
                    <td className="px-3 py-3 text-right hidden md:table-cell">
                      <span className="text-emerald-600 font-semibold dark:text-emerald-400">{ev.checkIns}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-primary">{money(ev.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {(data?.upcomingEvents ?? []).length > 0 && (
          <div className="rounded-2xl border bg-white dark:bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-base">Proximos eventos</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Publicados nos proximos 30 dias.</p>
              </div>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-3">
              {(data?.upcomingEvents ?? []).map((ev) => (
                <Link key={ev.id} href={`/events/${ev.id}`}
                  className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted/60 transition-colors group">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    {ev.format === "ONLINE" ? <Monitor className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{ev.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{dateTime(ev.startsAt)}{ev.city ? ` - ${ev.city}` : ""}</p>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full px-2 py-0.5 font-medium shrink-0">
                    Publicado
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border bg-white dark:bg-card p-5 shadow-sm flex flex-col">
          <h2 className="font-bold text-base mb-1">Taxa de check-in</h2>
          <p className="text-xs text-muted-foreground mb-5">Participantes que compareceram.</p>
          <div className="flex flex-col items-center justify-center flex-1 gap-4">
            <div className="relative">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(249 100% 62%)" strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  strokeDashoffset={`${2 * Math.PI * 50 * (1 - checkInRate / 100)}`}
                  transform="rotate(-90 60 60)"
                  style={{ transition: "stroke-dashoffset 1s ease" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-primary">{checkInRate}%</span>
                <span className="text-[10px] text-muted-foreground font-medium">compareceram</span>
              </div>
            </div>
            <div className="w-full space-y-2">
              {[
                { label: "Ingressos emitidos", value: data?.ticketsSold ?? 0, cls: "" },
                { label: "Check-ins", value: data?.checkIns ?? 0, cls: "text-emerald-600 dark:text-emerald-400" },
                { label: "Ausentes", value: (data?.ticketsSold ?? 0) - (data?.checkIns ?? 0), cls: "text-muted-foreground" }
              ].map((r) => (
                <div key={r.label} className="flex justify-between text-sm rounded-xl bg-muted/60 px-3 py-2">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className={`font-semibold ${r.cls}`}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
