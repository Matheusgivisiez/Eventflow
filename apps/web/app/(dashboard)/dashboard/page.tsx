"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarCheck, CircleDollarSign, TicketCheck, TrendingUp, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";

type Dashboard = {
  totalRevenueCents: number;
  totalFeesCents: number;
  ticketsSold: number;
  activeEvents: number;
  closedEvents: number;
  paidOrders: number;
  revenueByMonth: { month: string; totalCents: number }[];
};

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/dashboard")
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </div>
    );
  }

  const netRevenue = (data?.totalRevenueCents ?? 0) - (data?.totalFeesCents ?? 0);

  const cards = [
    {
      label: "Receita total",
      value: money(data?.totalRevenueCents),
      icon: CircleDollarSign,
      color: "bg-brand-purple",
      light: "bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20",
      trend: "+12% este mês"
    },
    {
      label: "Ingressos vendidos",
      value: String(data?.ticketsSold ?? 0),
      icon: TicketCheck,
      color: "bg-brand-violet",
      light: "bg-brand-violet/10 text-brand-violet dark:bg-brand-violet/20",
      trend: "+8% este mês"
    },
    {
      label: "Eventos ativos",
      value: String(data?.activeEvents ?? 0),
      icon: Activity,
      color: "bg-brand-pink",
      light: "bg-brand-pink/10 text-brand-pink dark:bg-brand-pink/20",
      trend: null
    },
    {
      label: "Eventos encerrados",
      value: String(data?.closedEvents ?? 0),
      icon: CalendarCheck,
      color: "bg-muted-foreground",
      light: "bg-muted text-muted-foreground",
      trend: null
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Resumo financeiro e operacional dos seus eventos.</p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border bg-white dark:bg-card p-5 shadow-sm card-hover">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground font-medium">{card.label}</p>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.light}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold tracking-tight">{card.value}</p>
              {card.trend && (
                <div className="mt-2 flex items-center gap-1 text-xs text-brand-purple font-medium">
                  <ArrowUpRight className="h-3 w-3" />
                  {card.trend}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Gráfico de receita */}
        <div className="rounded-2xl border bg-white dark:bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-bold">Receita por mês</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">Pagamentos confirmados no período.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.revenueByMonth ?? []}>
                <defs>
                  <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(249 100% 62%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(249 100% 62%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => money(Number(v)).replace("R$", "R$\u00a0")} tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(value) => [money(Number(value)), "Receita"]} />
                <Area
                  type="monotone"
                  dataKey="totalCents"
                  stroke="hsl(249 100% 62%)"
                  strokeWidth={2.5}
                  fill="url(#brandGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resumo financeiro */}
        <div className="rounded-2xl border bg-white dark:bg-card p-5 shadow-sm">
          <h2 className="font-bold mb-1">Resumo financeiro</h2>
          <p className="text-xs text-muted-foreground mb-5">Taxas, pedidos e saldo líquido.</p>
          <div className="space-y-3">
            <SummaryRow label="Pedidos pagos" value={String(data?.paidOrders ?? 0)} />
            <SummaryRow label="Receita bruta" value={money(data?.totalRevenueCents)} highlight />
            <SummaryRow label="Taxas" value={`-\u00a0${money(data?.totalFeesCents)}`} negative />
            <div className="border-t pt-3">
              <SummaryRow label="Receita líquida" value={money(netRevenue)} highlight large />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label, value, highlight, negative, large
}: {
  label: string; value: string | number; highlight?: boolean; negative?: boolean; large?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${large ? "text-base" : ""} ${highlight ? "text-primary" : negative ? "text-destructive" : ""}`}>
        {value}
      </span>
    </div>
  );
}
