"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Calendar, CreditCard, ShieldAlert, CheckCircle2, Clock,
  XCircle, Search, Building2, Loader2, ArrowDownToLine, Key, Crown
} from "lucide-react";
import { AdminVipPanel } from "@/components/courtesy/admin-vip-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { cn, money } from "@/lib/utils";

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
  event: { id: string; title: string };
  order: { id: string; buyerName: string; buyerEmail: string; userId?: string };
};

type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };
type AdminOverview = { users: number; events: number; payments: number; revenueCents: number };
type UserDetail = {
  user: AdminUser;
  orders: { id: string; status: string; createdAt: string; totalCents: number; event: { id: string; title: string; startsAt: string }; items: { quantity: number; ticketType: { name: string } }[]; tickets: { id: string; status: string; ownerId?: string }[] }[];
  ownedTickets: { id: string; status: string; orderId: string; event: { id: string; title: string }; ticketType: { name: string } }[];
};
type EventDetail = {
  event: Omit<AdminEvent, "ticketTypes"> & { ticketTypes: { id: string; name: string; sold: number; paid: number; quantity: number; priceCents: number; isActive: boolean; startsAt: string; endsAt: string }[] };
  ordersByStatus: { status: string; _count: { _all: number } }[];
  paymentsByStatus: { status: string; _count: { _all: number }; _sum: { amountCents: number | null } }[];
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

export default function AdminPage({ adminBase = "/admin" }: { adminBase?: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("users");
  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab && ["users", "events", "payments", "withdrawals", "vip"].includes(requestedTab)) setTab(requestedTab);
  }, []);
  const [userSearch, setUserSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentEvent, setPaymentEvent] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [pixKeys, setPixKeys] = useState<Record<string, string>>({});

  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => api<AdminOverview>("/admin/overview") });
  const users = useQuery({ queryKey: ["admin-users-page", userSearch, userPage], queryFn: () => api<PageResult<AdminUser>>(`/admin/users-page?search=${encodeURIComponent(userSearch)}&page=${userPage}`) });
  const events = useQuery({ queryKey: ["admin-events-page", eventSearch, eventPage], queryFn: () => api<PageResult<AdminEvent>>(`/admin/events-page?search=${encodeURIComponent(eventSearch)}&page=${eventPage}`) });
  const eventOptions = useQuery({ queryKey: ["admin-event-options"], queryFn: () => api<{ id: string; title: string; status: string; startsAt: string; tenant?: { name: string }; owner?: { name: string; email: string } }[]>("/admin/event-options") });
  const payments = useQuery({ queryKey: ["admin-payments-page", paymentStatus, paymentEvent, paymentPage], queryFn: () => api<PageResult<AdminPayment>>(`/admin/payments-page?status=${paymentStatus}&eventId=${encodeURIComponent(paymentEvent)}&page=${paymentPage}`) });
  const userDetail = useQuery({ queryKey: ["admin-user", selectedUser], queryFn: () => api<UserDetail>(`/admin/users/${selectedUser}`), enabled: !!selectedUser });
  const eventDetail = useQuery({ queryKey: ["admin-event", selectedEvent], queryFn: () => api<EventDetail>(`/admin/events/${selectedEvent}`), enabled: !!selectedEvent });
  const withdrawals = useQuery({ queryKey: ["admin-withdrawals"], queryFn: () => api<AdminWithdrawal[]>("/finance/withdrawals") });

  const approveWithdrawal = useMutation({
    mutationFn: ({ id, pixKey }: { id: string; pixKey: string }) =>
      api(`/finance/withdrawals/${id}/approve`, { method: "POST", body: JSON.stringify({ pixKey }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-withdrawals"] })
  });

  const pendingWithdrawals = (withdrawals.data ?? []).filter(w => w.status === "REQUESTED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Administração</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestão global da plataforma: usuários, eventos e pagamentos.</p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Usuários"     value={overview.data?.users ?? 0}     icon={<Users className="h-5 w-5 text-primary" />}          loading={overview.isLoading} />
        <KpiCard label="Eventos"      value={overview.data?.events ?? 0}    icon={<Calendar className="h-5 w-5 text-purple-500" />}     color="text-purple-600" loading={overview.isLoading} />
        <KpiCard label="Pagamentos"   value={overview.data?.payments ?? 0}  icon={<CreditCard className="h-5 w-5 text-emerald-500" />}  color="text-emerald-600" loading={overview.isLoading} />
        <KpiCard label="Receita total" value={money(overview.data?.revenueCents ?? 0)} icon={<Building2 className="h-5 w-5 text-rose-500" />} color="text-rose-600" loading={overview.isLoading} isMonetary />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-5">
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
          <TabsTrigger value="vip"><Crown className="h-4 w-4 mr-2" /> Convidados VIP</TabsTrigger>
        </TabsList>

        <TabsContent value="vip" className="mt-4">
          <AdminVipPanel events={eventOptions.data ?? []} loading={eventOptions.isLoading} />
        </TabsContent>

        {/* ── Users Tab ── */}
        <TabsContent value="users" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Usuários da plataforma</CardTitle>
              <Badge variant="secondary">{users.data?.total ?? 0} registros</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar por nome ou e-mail…" value={userSearch} onChange={e => { setUserSearch(e.target.value); setUserPage(1); }} />
              </div>
              {users.isLoading && <Skeleton className="h-64 w-full" />}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {users.data?.items.map(user => {
                  const roleCfg = ROLE_CONFIG[user.role] ?? { label: user.role, variant: "outline" as const };
                  return (
                    <button type="button" onClick={() => setSelectedUser(user.id)} key={user.id} className="w-full text-left flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/40 transition-colors focus-visible:outline-primary">
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
                    </button>
                  );
                })}
                {!users.isLoading && !users.isError && users.data?.items.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum usuário encontrado.</p>
                )}
              </div>
              {users.isError && <p className="text-sm text-destructive">Não foi possível carregar os usuários.</p>}
              <Pagination data={users.data} onPageChange={setUserPage} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Events Tab ── */}
        <TabsContent value="events" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Todos os eventos</CardTitle>
              <Badge variant="secondary">{events.data?.total ?? 0} registros</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar por título…" value={eventSearch} onChange={e => { setEventSearch(e.target.value); setEventPage(1); }} />
              </div>
              {events.isLoading && <Skeleton className="h-64 w-full" />}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {events.data?.items.map(ev => {
                  const statusCfg = EVENT_STATUS[ev.status] ?? { label: ev.status, variant: "outline" as const };
                  const totalTickets = ev.ticketTypes.reduce((s, t) => s + t.quantity, 0);
                  const soldTickets  = ev.ticketTypes.reduce((s, t) => s + t.sold, 0);
                  const pct = totalTickets > 0 ? (soldTickets / totalTickets) * 100 : 0;
                  return (
                    <button type="button" onClick={() => setSelectedEvent(ev.id)} key={ev.id} className="w-full text-left p-3 rounded-xl border hover:bg-muted/40 transition-colors focus-visible:outline-primary">
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
                    </button>
                  );
                })}
                {!events.isLoading && !events.isError && events.data?.items.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum evento encontrado.</p>
                )}
              </div>
              {events.isError && <p className="text-sm text-destructive">Não foi possível carregar os eventos.</p>}
              <Pagination data={events.data} onPageChange={setEventPage} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payments Tab ── */}
        <TabsContent value="payments" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Pagamentos recentes</CardTitle>
              <Badge variant="secondary">{payments.data?.total ?? 0} registros</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-medium space-y-1">Status
                  <select aria-label="Filtrar pagamentos por status" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={paymentStatus} onChange={e => { setPaymentStatus(e.target.value); setPaymentPage(1); }}>
                    <option value="">Todos os status</option>
                    <option value="PAID">Pago</option>
                    <option value="PENDING">Pendente</option>
                    <option value="CANCELED">Cancelado</option>
                    <option value="REFUNDED">Estornado</option>
                  </select>
                </label>
                <label className="text-xs font-medium space-y-1">Evento
                  <select aria-label="Filtrar pagamentos por evento" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={paymentEvent} onChange={e => { setPaymentEvent(e.target.value); setPaymentPage(1); }}>
                    <option value="">Todos os eventos</option>
                    {eventOptions.data?.map(ev => <option key={ev.id} value={ev.id}>{ev.title} · {new Date(ev.startsAt).toLocaleDateString("pt-BR")}</option>)}
                  </select>
                </label>
              </div>
              {payments.isLoading && <Skeleton className="h-64 w-full" />}
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {payments.data?.items.map(pay => {
                const cfg = PAY_STATUS[pay.status] ?? { label: pay.status, color: "text-muted-foreground", icon: <Clock className="h-3.5 w-3.5" /> };
                return (
                  <div key={pay.id} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/40 transition-colors">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted", cfg.color)}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button type="button" className="font-semibold text-sm truncate hover:underline text-left" onClick={() => setSelectedEvent(pay.event.id)}>{pay.event.title}</button>
                      <p className="text-xs text-muted-foreground truncate">{pay.order.buyerName} · {pay.order.buyerEmail}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{money(pay.amountCents)}</p>
                      <p className={cn("text-xs font-medium", cfg.color)}>{cfg.label}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(pay.createdAt).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                );
              })}
              {!payments.isLoading && !payments.isError && payments.data?.items.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum pagamento encontrado.</p>
              )}
              </div>
              {payments.isError && <p className="text-sm text-destructive">Não foi possível carregar os pagamentos.</p>}
              <Pagination data={payments.data} onPageChange={setPaymentPage} />
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
      <Dialog open={!!selectedUser} onOpenChange={open => { if (!open) setSelectedUser(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{userDetail.data?.user.name ?? "Usuário"}</DialogTitle>
            <DialogDescription>{userDetail.data?.user.email ?? "Compras e ingressos vinculados ao usuário"}</DialogDescription>
          </DialogHeader>
          {userDetail.isLoading && <Skeleton className="h-48 w-full" />}
          {userDetail.isError && <p className="text-sm text-destructive">Não foi possível carregar os dados deste usuário.</p>}
          {userDetail.data && <div className="space-y-5">
            <div className="text-sm text-muted-foreground">{userDetail.data.user.phone && <p>Telefone: {userDetail.data.user.phone}</p>}<p>Perfil: {ROLE_CONFIG[userDetail.data.user.role]?.label ?? userDetail.data.user.role}</p></div>
            <section className="space-y-2">
              <h3 className="font-semibold">Compras ({userDetail.data.orders.length})</h3>
              {userDetail.data.orders.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma compra vinculada ao usuário ou ao e-mail.</p>}
              {userDetail.data.orders.map(order => <div key={order.id} className="rounded-xl border p-3 text-sm space-y-1">
                <div className="flex justify-between gap-3"><button type="button" className="font-semibold text-left hover:underline" onClick={() => { setSelectedUser(null); setSelectedEvent(order.event.id); }}>{order.event.title}</button><span>{money(order.totalCents)}</span></div>
                <p className="text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("pt-BR")} · {PAY_STATUS[order.status]?.label ?? order.status}</p>
                <p>{order.items.map(item => `${item.quantity}× ${item.ticketType.name}`).join(" · ") || "Sem itens"}</p>
                <p className="text-muted-foreground">{order.tickets.length} ingresso(s) emitido(s)</p>
              </div>)}
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold">Ingressos em posse ({userDetail.data.ownedTickets.length})</h3>
              {userDetail.data.ownedTickets.length === 0 && <p className="text-sm text-muted-foreground">Nenhum ingresso vinculado à conta.</p>}
              {userDetail.data.ownedTickets.map(ticket => <div key={ticket.id} className="rounded-xl border p-3 text-sm">
                <p className="font-semibold">{ticket.event.title}</p>
                <p className="text-muted-foreground">{ticket.ticketType.name} · {ticket.status === "AVAILABLE" ? "Disponível" : ticket.status === "USED" ? "Utilizado" : "Cancelado"}</p>
              </div>)}
            </section>
          </div>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!selectedEvent} onOpenChange={open => { if (!open) setSelectedEvent(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{eventDetail.data?.event.title ?? "Evento"}</DialogTitle>
            <DialogDescription>{eventDetail.data?.event.tenant?.name} · {eventDetail.data?.event.owner?.name}</DialogDescription>
          </DialogHeader>
          {eventDetail.isLoading && <Skeleton className="h-48 w-full" />}
          {eventDetail.isError && <p className="text-sm text-destructive">Não foi possível carregar os dados deste evento.</p>}
          {eventDetail.data && <div className="space-y-5">
            <p className="text-sm text-muted-foreground">{new Date(eventDetail.data.event.startsAt).toLocaleString("pt-BR")} · {EVENT_STATUS[eventDetail.data.event.status]?.label ?? eventDetail.data.event.status}</p>
            <Button asChild size="sm"><Link href={`${adminBase}/events/${eventDetail.data.event.id}/edit`}>Editar evento como admin</Link></Button>
            <section className="space-y-2"><h3 className="font-semibold">Lotes de ingressos</h3>
              {eventDetail.data.event.ticketTypes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lote cadastrado.</p>}
              {eventDetail.data.event.ticketTypes.map(lot => <div key={lot.id} className="rounded-xl border p-3 text-sm space-y-2">
                <div className="flex justify-between gap-3"><span className="font-semibold">{lot.name}</span><span>{money(lot.priceCents)}</span></div>
                <p className="text-muted-foreground">{lot.paid} pagos · {Math.max(0, lot.sold - lot.paid)} reservados · {Math.max(0, lot.quantity - lot.sold)} disponíveis · {lot.quantity} no total</p>
                <p className="text-muted-foreground">{lot.isActive ? "Ativo" : "Inativo"} · Vendas de {new Date(lot.startsAt).toLocaleDateString("pt-BR")} a {new Date(lot.endsAt).toLocaleDateString("pt-BR")}</p>
                <div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${lot.quantity ? Math.min(100, lot.sold / lot.quantity * 100) : 0}%` }} /></div>
              </div>)}
            </section>
            <section className="space-y-2"><h3 className="font-semibold">Pedidos e pagamentos</h3>
              <p className="text-sm">Pedidos: {eventDetail.data.ordersByStatus.map(row => `${PAY_STATUS[row.status]?.label ?? row.status}: ${row._count._all}`).join(" · ") || "Nenhum"}</p>
              <p className="text-sm">Pagamentos: {eventDetail.data.paymentsByStatus.map(row => `${PAY_STATUS[row.status]?.label ?? row.status}: ${row._count._all}`).join(" · ") || "Nenhum"}</p>
              <p className="text-sm font-semibold">Receita paga: {money(eventDetail.data.paymentsByStatus.find(row => row.status === "PAID")?._sum.amountCents ?? 0)}</p>
              <Button variant="outline" size="sm" onClick={() => { setPaymentEvent(eventDetail.data!.event.id); setPaymentPage(1); setTab("payments"); setSelectedEvent(null); }}>Ver pagamentos deste evento</Button>
            </section>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Pagination({ data, onPageChange }: { data?: { total: number; page: number; pageSize: number }; onPageChange: (page: number) => void }) {
  if (!data || data.total <= data.pageSize) return null;
  const pages = Math.ceil(data.total / data.pageSize);
  return <div className="flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
    <span>Página {data.page} de {pages} · {data.total} registros</span>
    <div className="flex gap-2"><Button size="sm" variant="outline" disabled={data.page <= 1} onClick={() => onPageChange(data.page - 1)}>Anterior</Button><Button size="sm" variant="outline" disabled={data.page >= pages} onClick={() => onPageChange(data.page + 1)}>Próxima</Button></div>
  </div>;
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
