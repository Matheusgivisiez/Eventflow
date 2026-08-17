"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Calendar, CreditCard, ShieldAlert, CheckCircle2, Clock,
  XCircle, Search, Building2, Loader2, ArrowDownToLine, Key
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { cn, dateTime, money } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminUser = {
  id: string; name: string; email: string; phone?: string;
  role: string; createdAt: string;
  tenant?: { id: string; name: string; logoUrl?: string };
};

type AdminEvent = {
  id: string; title: string; status: string; startsAt: string; format: string;
  tenant?: { name: string };
  owner?: { name: string; email: string };
  ticketTypes: { sold: number; quantity: number }[];
};

type AdminPayment = {
  id: string; status: string; amountCents: number; createdAt: string;
  event?: { title: string };
  order?: { buyerEmail: string };
};

type AdminWithdrawal = {
  id: string; tenantId: string; amountCents: number;
  status: string; pixKey?: string; requestedAt: string;
};

// ─── Status helpers ───────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ADMIN:     { label: "Admin",     variant: "destructive" },
  ORGANIZER: { label: "Organizer", variant: "default" },
  TEAM:      { label: "Team",      variant: "secondary" },
  BUYER:     { label: "Buyer",     variant: "outline" },
};

const PAY_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:  { label: "Pendente",  color: "text-amber-600",  icon: <Clock className="h-3.5 w-3.5" /> },
  PAID:     { label: "Pago",      color: "text-emerald-600", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  FAILED:   { label: "Falhou",    color: "text-rose-600",   icon: <XCircle className="h-3.5 w-3.5" /> },
  CANCELED: { label: "Cancelado", color: "text-rose-600",   icon: <XCircle className="h-3.5 w-3.5" /> },
  REFUNDED: { label: "Estornado", color: "text-blue-600",   icon: <ShieldAlert className="h-3.5 w-3.5" /> },
};

const EVENT_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT:     { label: "Rascunho",  variant: "outline"    },
  PUBLISHED: { label: "Publicado", variant: "default"    },
  CLOSED:    { label: "Encerrado", variant: "secondary"  },
};

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const qc = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [pixKeys, setPixKeys] = useState<Record<string, string>>({});

  const users    = useQuery({ queryKey: ["admin-users"],       queryFn: () => api<AdminUser[]>("/admin/users") });
  const events   = useQuery({ queryKey: ["admin-events"],      queryFn: () => api<AdminEvent[]>("/admin/events") });
  const payments = useQuery({ queryKey: ["admin-payments"],    queryFn: () => api<AdminPayment[]>("/admin/payments") });
  const withdrawals = useQuery({ queryKey: ["admin-withdrawals"], queryFn: () => api<AdminWithdrawal[]>("/finance/withdrawals") });

  const approveWithdrawal = useMutation({
    mutationFn: ({ id, pixKey }: { id: string; pixKey: string }) =>
      api(`/finance/withdrawals/${id}/approve`, { method: "POST", body: JSON.stringify({ pixKey }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-withdrawals"] })
  });

  const pendingWithdrawals = (withdrawals.data ?? []).filter(w => w.status === "REQUESTED");

  const filteredUsers = (users.data ?? []).filter(u =>
    !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())
  );
  const filteredEvents = (events.data ?? []).filter(e =>
    !eventSearch || e.title.toLowerCase().includes(eventSearch.toLowerCase())
  );

  const totalRevenue = (payments.data ?? [])
    .filter(p => p.status === "PAID")
    .reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Administração</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestão global da plataforma: usuários, eventos e pagamentos.</p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Usuários"     value={users.data?.length ?? 0}     icon={<Users className="h-5 w-5 text-primary" />}          loading={users.isLoading} />
        <KpiCard label="Eventos"      value={events.data?.length ?? 0}    icon={<Calendar className="h-5 w-5 text-purple-500" />}     color="text-purple-600" loading={events.isLoading} />
        <KpiCard label="Pagamentos"   value={payments.data?.length ?? 0}  icon={<CreditCard className="h-5 w-5 text-emerald-500" />}  color="text-emerald-600" loading={payments.isLoading} />
        <KpiCard label="Receita total" value={money(totalRevenue)}         icon={<Building2 className="h-5 w-5 text-rose-500" />}      color="text-rose-600" loading={payments.isLoading} isMonetary />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" /> Usuários</TabsTrigger>
          <TabsTrigger value="events"><Calendar className="h-4 w-4 mr-2" /> Eventos</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="h-4 w-4 mr-2" /> Pagamentos</TabsTrigger>
          <TabsTrigger value="withdrawals" className="relative">
            <ArrowDownToLine className="h-4 w-4 mr-2" /> Saques
            {pendingWithdrawals.length > 0 && (
              <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {pendingWithdrawals.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Users Tab ── */}
        <TabsContent value="users" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Usuários da plataforma</CardTitle>
              <Badge variant="secondary">{filteredUsers.length} registros</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar por nome ou e-mail…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              </div>
              {users.isLoading && <Skeleton className="h-64 w-full" />}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filteredUsers.map(user => {
                  const roleCfg = ROLE_CONFIG[user.role] ?? { label: user.role, variant: "outline" as const };
                  return (
                    <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/40 transition-colors">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        {user.tenant && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Building2 className="h-3 w-3" />{user.tenant.name}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={roleCfg.variant}>{roleCfg.label}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(user.createdAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                  );
                })}
                {!users.isLoading && filteredUsers.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum usuário encontrado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Events Tab ── */}
        <TabsContent value="events" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Todos os eventos</CardTitle>
              <Badge variant="secondary">{filteredEvents.length} registros</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar por título…" value={eventSearch} onChange={e => setEventSearch(e.target.value)} />
              </div>
              {events.isLoading && <Skeleton className="h-64 w-full" />}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filteredEvents.map(ev => {
                  const statusCfg = EVENT_STATUS[ev.status] ?? { label: ev.status, variant: "outline" as const };
                  const totalTickets = ev.ticketTypes.reduce((s, t) => s + t.quantity, 0);
                  const soldTickets  = ev.ticketTypes.reduce((s, t) => s + t.sold, 0);
                  const pct = totalTickets > 0 ? (soldTickets / totalTickets) * 100 : 0;
                  return (
                    <div key={ev.id} className="p-3 rounded-xl border hover:bg-muted/40 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{ev.title}</p>
                          <p className="text-xs text-muted-foreground">{ev.tenant?.name} · {ev.owner?.name}</p>
                        </div>
                        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span>{new Date(ev.startsAt).toLocaleDateString("pt-BR")}</span>
                        <span>{soldTickets}/{totalTickets} ingressos ({Math.round(pct)}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full", pct >= 90 ? "bg-rose-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {!events.isLoading && filteredEvents.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum evento encontrado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payments Tab ── */}
        <TabsContent value="payments" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Pagamentos recentes</CardTitle>
              <Badge variant="secondary">{payments.data?.length ?? 0} registros</Badge>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {payments.isLoading && <Skeleton className="h-64 w-full" />}
              {payments.data?.map(pay => {
                const cfg = PAY_STATUS[pay.status] ?? { label: pay.status, color: "text-muted-foreground", icon: <Clock className="h-3.5 w-3.5" /> };
                return (
                  <div key={pay.id} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/40 transition-colors">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted", cfg.color)}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{pay.event?.title ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{pay.order?.buyerEmail ?? "—"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{money(pay.amountCents)}</p>
                      <p className={cn("text-xs font-medium", cfg.color)}>{cfg.label}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(pay.createdAt).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                );
              })}
              {!payments.isLoading && (payments.data?.length ?? 0) === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum pagamento encontrado.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Withdrawals Tab ── */}
        <TabsContent value="withdrawals" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4 text-amber-500" /> Saques pendentes
              </CardTitle>
              <Badge variant="outline" className="border-amber-500 text-amber-600">
                {pendingWithdrawals.length} aguardando
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {withdrawals.isLoading && <Skeleton className="h-64 w-full" />}
              {!withdrawals.isLoading && pendingWithdrawals.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm">Nenhum saque pendente. ✓</p>
                </div>
              )}
              {pendingWithdrawals.map(w => (
                <div key={w.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-lg">{money(w.amountCents)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Solicitado em {new Date(w.requestedAt).toLocaleString("pt-BR")}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">ID: {w.tenantId}</p>
                    </div>
                    <Badge variant="outline" className="border-amber-500 text-amber-600 shrink-0">
                      <Clock className="h-3 w-3 mr-1" /> Pendente
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        className="pl-8 h-9 text-sm"
                        placeholder="Chave PIX do organizador"
                        value={pixKeys[w.id] ?? ""}
                        onChange={e => setPixKeys(prev => ({ ...prev, [w.id]: e.target.value }))}
                      />
                    </div>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 shrink-0"
                      disabled={!pixKeys[w.id] || approveWithdrawal.isPending}
                      onClick={() => approveWithdrawal.mutate({ id: w.id, pixKey: pixKeys[w.id] })}
                    >
                      {approveWithdrawal.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <CheckCircle2 className="h-4 w-4" />}
                      Aprovar PIX
                    </Button>
                  </div>
                </div>
              ))}
              {/* Approved/Paid history */}
              {(withdrawals.data ?? []).filter(w => w.status !== "REQUESTED").length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Histórico</p>
                  {(withdrawals.data ?? []).filter(w => w.status !== "REQUESTED").map(w => (
                    <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/40 transition-colors">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{money(w.amountCents)}</p>
                        <p className="text-xs text-muted-foreground truncate">{w.pixKey ?? "—"}</p>
                      </div>
                      <Badge variant="secondary" className="text-emerald-600 shrink-0">{w.status}</Badge>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, icon, color, loading, isMonetary }: {
  label: string; value: string | number; icon: React.ReactNode; color?: string; loading?: boolean; isMonetary?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-white dark:bg-card shadow-sm p-4 flex items-center gap-3">
      <div className="shrink-0 p-2 rounded-xl bg-muted/60">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {loading
          ? <Skeleton className="h-7 w-20 mt-1" />
          : <p className={cn("font-extrabold tracking-tight", isMonetary ? "text-lg" : "text-xl", color ?? "text-foreground")}>{value}</p>
        }
      </div>
    </div>
  );
}
