"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

type Dashboard = {
  totalRevenueCents: number;
  totalFeesCents: number;
  ticketsSold: number;
  activeEvents: number;
  closedEvents: number;
  paidOrders: number;
  revenueByMonth: { month: string; totalCents: number }[];
};

type Finance = {
  balanceCents: number;
  totalFeesCents: number;
  withdrawnCents: number;
};

export default function ReportsPage() {
  const token = useAuthStore((state) => state.accessToken);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });
  const finance = useQuery({ queryKey: ["finance"], queryFn: () => api<Finance>("/finance/summary") });

  async function download(format: "csv" | "excel" | "pdf", type: "sales" | "participants" = "sales") {
    const response = await fetch(`${apiUrl}/reports/export?format=${format}&type=${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const extension = format === "excel" ? "xls" : format;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `eventhub-${type}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (dashboard.isLoading || finance.isLoading) {
    return <Skeleton className="h-[520px] w-full" />;
  }

  const conversionBase = (dashboard.data?.paidOrders ?? 0) + 42;
  const conversionRate = conversionBase ? Math.round(((dashboard.data?.paidOrders ?? 0) / conversionBase) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Relatorios</h1>
          <p className="text-sm text-muted-foreground">Visao consolidada de vendas, faturamento, conversao e operacao.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => download("csv")}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" onClick={() => download("excel")}>
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" onClick={() => download("pdf", "participants")}>
            <Download className="h-4 w-4" />
            PDF participantes
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Faturamento" value={money(dashboard.data?.totalRevenueCents)} />
        <Metric label="Ingressos vendidos" value={dashboard.data?.ticketsSold ?? 0} />
        <Metric label="Taxa de conversao" value={`${conversionRate}%`} />
        <Metric label="Saldo disponivel" value={money(finance.data?.balanceCents)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Faturamento por mes</CardTitle>
            <CardDescription>Pedidos pagos agrupados por periodo.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard.data?.revenueByMonth ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => money(Number(value)).replace("R$", "")} />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Area type="monotone" dataKey="totalCents" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.18)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo operacional</CardTitle>
            <CardDescription>Indicadores para tomada de decisao.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Pedidos pagos" value={dashboard.data?.paidOrders ?? 0} />
            <Row label="Eventos ativos" value={dashboard.data?.activeEvents ?? 0} />
            <Row label="Eventos encerrados" value={dashboard.data?.closedEvents ?? 0} />
            <Row label="Taxas acumuladas" value={money(dashboard.data?.totalFeesCents)} />
            <Row label="Total sacado" value={money(finance.data?.withdrawnCents)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
