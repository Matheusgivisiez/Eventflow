"use client";

import { type ComponentType, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bot,
  Building2,
  ChartNoAxesCombined,
  Cloud,
  Code2,
  Fingerprint,
  Globe2,
  KeyRound,
  Mail,
  Megaphone,
  MonitorSmartphone,
  MousePointerClick,
  Network,
  Radar,
  Route,
  Save,
  ScanLine,
  ShieldCheck,
  Sofa,
  Users
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";

type EnterpriseOverview = {
  readiness: Record<string, boolean>;
  counters: Record<string, number>;
  scaleTargets: Record<string, string>;
};

type Executive = {
  mrrCents: number;
  arrCents: number;
  ltvCents: number;
  cacCents: number;
  churnRateBps: number;
  revenueCents: number;
  profitCents: number;
  organizersCount: number;
  paidOrders: number;
};

const modules = [
  { key: "whiteLabel", label: "White label", icon: Globe2 },
  { key: "mobileOffline", label: "Mobile offline", icon: MonitorSmartphone },
  { key: "affiliates", label: "Afiliados", icon: MousePointerClick },
  { key: "crm", label: "CRM", icon: Users },
  { key: "marketingAutomation", label: "Automacao", icon: Megaphone },
  { key: "analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { key: "publicApi", label: "API publica", icon: Code2 },
  { key: "seatMaps", label: "Assentos", icon: Sofa },
  { key: "marketplace", label: "Marketplace", icon: Building2 },
  { key: "ai", label: "IA", icon: Bot },
  { key: "security", label: "Seguranca", icon: ShieldCheck },
  { key: "infrastructure", label: "Infraestrutura", icon: Cloud }
];

export default function EnterprisePage() {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ["enterprise-overview"], queryFn: () => api<EnterpriseOverview>("/enterprise/overview") });
  const executive = useQuery({ queryKey: ["enterprise-executive"], queryFn: () => api<Executive>("/enterprise/executive") });
  const infrastructure = useQuery({ queryKey: ["enterprise-infra"], queryFn: () => api<Record<string, string[] | string>>("/enterprise/infrastructure"), staleTime: Infinity });
  const apiDocs = useQuery({ queryKey: ["enterprise-api-docs"], queryFn: () => api<Record<string, unknown>>("/enterprise/public-api/docs", { auth: false }), staleTime: Infinity });

  const whiteLabelMutation = useMutation({
    mutationFn: (body: Record<string, string>) => api("/enterprise/white-label", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enterprise-overview"] })
  });

  const executiveRows = useMemo(
    () => [
      { label: "MRR", value: money(executive.data?.mrrCents), icon: Radar },
      { label: "ARR", value: money(executive.data?.arrCents), icon: Route },
      { label: "LTV", value: money(executive.data?.ltvCents), icon: BadgeCheck },
      { label: "CAC", value: money(executive.data?.cacCents), icon: Fingerprint },
      { label: "Receita", value: money(executive.data?.revenueCents), icon: ChartNoAxesCombined },
      { label: "Lucro", value: money(executive.data?.profitCents), icon: ShieldCheck }
    ],
    [executive.data]
  );

  if (overview.isLoading || executive.isLoading) return <Skeleton className="h-[620px] w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Enterprise</h1>
          <p className="text-sm text-muted-foreground">Operacao multi-tenant para milhares de organizadores simultaneos.</p>
        </div>
        <Badge className="w-fit gap-1" variant="secondary">
          <Network className="h-3.5 w-3.5" />
          Plataforma expandida
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {executiveRows.map((row) => {
          const Icon = row.icon;
          return (
            <Card key={row.label}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardDescription>{row.label}</CardDescription>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">{row.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => {
          const Icon = module.icon;
          const active = overview.data?.readiness[module.key];
          return (
            <Card key={module.key}>
              <CardContent className="flex h-20 items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{module.label}</p>
                    <p className="text-xs text-muted-foreground">{active ? "Ativo" : "Pendente"}</p>
                  </div>
                </div>
                <Badge variant={active ? "default" : "secondary"}>{active ? "Ready" : "Setup"}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="growth" className="space-y-4">
        <TabsList className="grid h-auto grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="growth">Growth</TabsTrigger>
          <TabsTrigger value="brand">Marca</TabsTrigger>
          <TabsTrigger value="mobile">Mobile</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="seats">Assentos</TabsTrigger>
          <TabsTrigger value="security">Seguranca</TabsTrigger>
          <TabsTrigger value="infra">Infra</TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Receita Enterprise</CardTitle>
              <CardDescription>MRR, conversao, campanhas e origem das vendas.</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { label: "MRR", value: executive.data?.mrrCents ?? 0 },
                    { label: "ARR", value: executive.data?.arrCents ?? 0 },
                    { label: "Receita", value: executive.data?.revenueCents ?? 0 },
                    { label: "Lucro", value: executive.data?.profitCents ?? 0 }
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(value) => money(Number(value)).replace("R$", "")} />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.18)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Operacao</CardTitle>
              <CardDescription>Contadores consolidados dos novos modulos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(overview.data?.counters ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="capitalize text-muted-foreground">{key}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brand">
          <Card>
            <CardHeader>
              <CardTitle>White label</CardTitle>
              <CardDescription>Dominio proprio, logo, tema e emails personalizados.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  whiteLabelMutation.mutate(Object.fromEntries(form.entries()) as Record<string, string>);
                }}
              >
                <Field name="customDomain" label="Dominio" placeholder="ingressos.suaempresa.com" />
                <Field name="logoUrl" label="Logo" placeholder="https://..." />
                <Field name="primaryColor" label="Cor primaria" placeholder="#111827" />
                <Field name="secondaryColor" label="Cor secundaria" placeholder="#2563eb" />
                <Field name="senderName" label="Remetente" placeholder="Sua produtora" />
                <Field name="senderEmail" label="Email" placeholder="ingressos@suaempresa.com" />
                <div className="md:col-span-2">
                  <Button className="gap-2" disabled={whiteLabelMutation.isPending}>
                    <Save className="h-4 w-4" />
                    Salvar marca
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mobile" className="grid gap-4 lg:grid-cols-3">
          <Feature title="React Native" description="App Android/iOS em apps/mobile com Expo, SQLite e fila de sincronizacao." icon={MonitorSmartphone} />
          <Feature title="Check-in offline" description="Scans ficam locais em SQLite e sobem em lote para /enterprise/mobile/checkin-sync." icon={ScanLine} />
          <Feature title="Sincronizacao" description="Conflitos, duplicidades e recusas sao auditados no batch de check-in." icon={Route} />
        </TabsContent>

        <TabsContent value="analytics" className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Funil e dispositivos</CardTitle>
              <CardDescription>Mapa de calor, conversao, origem, campanhas, GA e Meta Pixel.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ label: "Views", value: 1240 }, { label: "Checkout", value: 420 }, { label: "Pagos", value: executive.data?.paidOrders ?? 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Feature title="Integrações" description="Google Analytics, Meta Pixel, eventos internos e snapshots de heatmap." icon={ChartNoAxesCombined} />
        </TabsContent>

        <TabsContent value="api" className="grid gap-4 lg:grid-cols-2">
          <Feature title="OAuth e API Keys" description="Clientes OAuth, chaves por escopo, secrets com hash e revogacao." icon={KeyRound} />
          <Card>
            <CardHeader>
              <CardTitle>Documentacao</CardTitle>
              <CardDescription>Contrato publico exposto pela API Enterprise.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(apiDocs.data ?? {}, null, 2)}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seats" className="grid gap-4 lg:grid-cols-3">
          <Feature title="Assentos numerados" description="Mapas versionados com secoes, coordenadas e status por assento." icon={Sofa} />
          <Feature title="Bloqueio temporario" description="Holds com TTL por sessao para evitar overbooking." icon={Route} />
          <Feature title="Reserva e compra" description="Checkout aceita seatIds e marca assentos vendidos no pagamento." icon={BadgeCheck} />
        </TabsContent>

        <TabsContent value="security" className="grid gap-4 lg:grid-cols-4">
          <Feature title="2FA" description="Segredo por usuario, recovery codes e flag de conta protegida." icon={Fingerprint} />
          <Feature title="LGPD" description="Consentimentos, auditoria, exportacao e exclusao operacional." icon={ShieldCheck} />
          <Feature title="Anti fraude" description="Sinais por pedido, score, motivos e revisao." icon={Radar} />
          <Feature title="Backups" description="Jobs automaticos com storage, checksum e status." icon={Cloud} />
        </TabsContent>

        <TabsContent value="infra">
          <Card>
            <CardHeader>
              <CardTitle>Infraestrutura escalavel</CardTitle>
              <CardDescription>Docker, CI/CD, AWS, Kubernetes, Redis Cluster, RabbitMQ, Prometheus e Grafana.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {Object.entries(infrastructure.data ?? {}).map(([key, value]) => (
                <div key={key} className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium capitalize">{key}</p>
                  <p className="text-sm text-muted-foreground">{Array.isArray(value) ? value.join(", ") : value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} placeholder={placeholder} />
    </div>
  );
}

function Feature({ title, description, icon: Icon }: { title: string; description: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          Disponivel via API Enterprise
        </div>
      </CardContent>
    </Card>
  );
}
