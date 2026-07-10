"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Megaphone, CheckCircle2, XCircle, Search, Clock, Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { dateTime, cn } from "@/lib/utils";

type Promoter = {
  id: string;
  userId: string;
  document: string;
  city: string;
  state: string;
  instagram: string;
  pixKey: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "BLOCKED";
  createdAt: string;
  user: { name: string; email: string; phone: string };
  _count: { eventLinks: number };
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING:   { label: "Pendente",  variant: "outline" },
  ACTIVE:    { label: "Ativo",     variant: "default" },
  SUSPENDED: { label: "Suspenso",  variant: "secondary" },
  BLOCKED:   { label: "Bloqueado", variant: "destructive" },
};

export default function PromotersManagementPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: promoters, isLoading } = useQuery<Promoter[]>({
    queryKey: ["admin-promoters"],
    queryFn: () => api<Promoter[]>("/promoters")
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      api(`/promoters/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-promoters"] })
  });

  const filtered = (promoters ?? []).filter(p => 
    !search || p.user.name.toLowerCase().includes(search.toLowerCase()) || p.user.email.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = (promoters ?? []).filter(p => p.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Gestão de Promoters</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie sua equipe de vendas e comissionados.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Convidar Promoter
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total de Promoters" value={promoters?.length ?? 0} icon={<Megaphone className="h-5 w-5 text-primary" />} loading={isLoading} />
        <KpiCard label="Pendentes" value={pendingCount} icon={<Clock className="h-5 w-5 text-amber-500" />} color="text-amber-600" loading={isLoading} />
        <KpiCard label="Ativos" value={(promoters ?? []).filter(p => p.status === "ACTIVE").length} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} color="text-emerald-600" loading={isLoading} />
        <KpiCard label="Bloqueados" value={(promoters ?? []).filter(p => p.status === "BLOCKED").length} icon={<XCircle className="h-5 w-5 text-rose-500" />} color="text-rose-600" loading={isLoading} />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Promoters cadastrados</CardTitle>
          <Badge variant="secondary">{filtered.length} registros</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome ou e-mail…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-muted-foreground border-2 border-dashed rounded-xl">
              <Megaphone className="h-10 w-10 opacity-30 mb-2" />
              <p className="text-sm">Nenhum promoter encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(p => {
                const cfg = STATUS_CONFIG[p.status];
                return (
                  <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                        {p.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{p.user.name}</p>
                        <p className="text-xs text-muted-foreground">{p.user.email} {p.user.phone ? `· ${p.user.phone}` : ""}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={cfg.variant} className="text-[10px] py-0">{cfg.label}</Badge>
                          <span className="text-[10px] text-muted-foreground">{p._count.eventLinks} eventos</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {p.status === "PENDING" && (
                        <Button 
                          size="sm" 
                          variant="default"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: p.id, status: "ACTIVE" })}
                        >
                          {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                          Aprovar
                        </Button>
                      )}
                      {p.status === "ACTIVE" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: p.id, status: "SUSPENDED" })}
                        >
                          Suspender
                        </Button>
                      )}
                      {p.status === "SUSPENDED" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: p.id, status: "ACTIVE" })}
                        >
                          Reativar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon, color, loading }: { label: string; value: string | number; icon: React.ReactNode; color?: string; loading?: boolean }) {
  return (
    <div className="rounded-2xl border bg-white dark:bg-card shadow-sm p-4 flex items-center gap-3">
      <div className="shrink-0 p-2 rounded-xl bg-muted/60">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {loading ? <Skeleton className="h-6 w-16 mt-1" /> : <p className={cn("text-xl font-extrabold", color)}>{value}</p>}
      </div>
    </div>
  );
}
