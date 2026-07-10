"use client";

import { useQuery } from "@tanstack/react-query";
import { DollarSign, MousePointerClick, ShoppingBag, Target, ArrowUpRight, Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

type DashboardData = {
  promoter: any;
  stats: {
    totalClicks: number;
    totalConversions: number;
    totalRevenueCents: number;
    totalCommissionsCents: number;
    availableBalanceCents: number;
    withdrawnCents: number;
  };
  links: any[];
};

export default function PromoterDashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["promoter-dashboard"],
    queryFn: () => api("/promoter-portal/dashboard")
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const { stats, links } = data || {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Visão Geral</h1>
        <p className="text-muted-foreground mt-1">Acompanhe suas métricas de vendas e comissões.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Saldo Disponível" 
          value={(stats?.availableBalanceCents ?? 0) / 100} 
          isCurrency 
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          description="Pronto para saque"
        />
        <KpiCard 
          title="Comissões Acumuladas" 
          value={(stats?.totalCommissionsCents ?? 0) / 100} 
          isCurrency 
          icon={<Target className="h-5 w-5 text-primary" />}
          description="Total já ganho"
        />
        <KpiCard 
          title="Total de Vendas" 
          value={stats?.totalConversions ?? 0} 
          icon={<ShoppingBag className="h-5 w-5 text-indigo-600" />}
          description="Ingressos vendidos"
        />
        <KpiCard 
          title="Total de Cliques" 
          value={stats?.totalClicks ?? 0} 
          icon={<MousePointerClick className="h-5 w-5 text-amber-600" />}
          description="Nos seus links"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Eventos Ativos</CardTitle>
            <CardDescription>Eventos que você está promovendo</CardDescription>
          </CardHeader>
          <CardContent>
            {links?.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-muted-foreground border-2 border-dashed rounded-xl">
                <Megaphone className="h-10 w-10 opacity-30 mb-2" />
                <p className="text-sm">Você ainda não está promovendo eventos.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {links?.map((link: any) => (
                  <div key={link.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30">
                    <div>
                      <p className="font-semibold">{link.event.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Comissão: {link.commissionType === "PERCENTAGE" ? `${link.commissionValue / 100}%` : `R$ ${link.commissionValue / 100}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{link.conversions} vendas</p>
                      <p className="text-xs text-emerald-600 font-semibold">
                        +{(link.commissionAcumCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value, isCurrency = false, icon, description }: any) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-extrabold tracking-tight">
              {isCurrency 
                ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) 
                : value.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="p-3 bg-muted/50 rounded-xl">
            {icon}
          </div>
        </div>
        {description && (
          <div className="mt-4 flex items-center text-xs text-muted-foreground">
            <ArrowUpRight className="h-3 w-3 mr-1 text-emerald-500" />
            {description}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
