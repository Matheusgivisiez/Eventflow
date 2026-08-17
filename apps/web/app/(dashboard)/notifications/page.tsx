"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, Mail, MessageSquare, CheckCircle2, Clock, XCircle, Filter, ShoppingBag, UserCheck, Megaphone
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

type NotifLog = {
  id: string;
  type: "EMAIL" | "WHATSAPP" | "PUSH";
  event: string;
  recipient: string;
  status?: string;
  sentAt?: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  EMAIL:     { label: "E-mail",    icon: <Mail className="h-4 w-4" />,          color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-500/20"   },
  WHATSAPP:  { label: "WhatsApp",  icon: <MessageSquare className="h-4 w-4" />, color: "text-green-600",  bg: "bg-green-100 dark:bg-green-500/20"  },
  PUSH:      { label: "Push",      icon: <Bell className="h-4 w-4" />,          color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-500/20" },
};

const EVENT_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  PURCHASE_CONFIRMED: { label: "Compra confirmada",  icon: <ShoppingBag className="h-3.5 w-3.5" /> },
  PAYMENT_APPROVED:   { label: "Pagamento aprovado", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  CHECK_IN:           { label: "Check-in",           icon: <UserCheck className="h-3.5 w-3.5" /> },
  EVENT_REMINDER:     { label: "Lembrete de evento", icon: <Megaphone className="h-3.5 w-3.5" /> },
};

export default function NotificationsPage() {
  const [typeFilter, setTypeFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");

  const { data: logs, isLoading } = useQuery<NotifLog[]>({
    queryKey: ["notification-logs", typeFilter, eventFilter],
    queryFn: () => {
      const q = new URLSearchParams();
      if (typeFilter) q.set("type", typeFilter);
      if (eventFilter) q.set("event", eventFilter);
      return api<NotifLog[]>(`/notifications?${q.toString()}`);
    },
  });

  // Compute stats
  const total = logs?.length ?? 0;
  const byType = {
    EMAIL:    logs?.filter(l => l.type === "EMAIL").length ?? 0,
    WHATSAPP: logs?.filter(l => l.type === "WHATSAPP").length ?? 0,
    PUSH:     logs?.filter(l => l.type === "PUSH").length ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Central de Notificações</h1>
        <p className="text-sm text-muted-foreground mt-1">Histórico de notificações enviadas por e-mail, WhatsApp e push.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total enviado" value={total} icon={<Bell className="h-5 w-5 text-primary" />} />
        <StatCard label="E-mails" value={byType.EMAIL} icon={<Mail className="h-5 w-5 text-blue-500" />} color="text-blue-600" />
        <StatCard label="WhatsApp" value={byType.WHATSAPP} icon={<MessageSquare className="h-5 w-5 text-green-500" />} color="text-green-600" />
        <StatCard label="Push" value={byType.PUSH} icon={<Bell className="h-5 w-5 text-blue-500" />} color="text-blue-600" />
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr]">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Canal</label>
            <div className="flex flex-wrap gap-2">
              {["", "EMAIL", "WHATSAPP", "PUSH"].map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {t === "" ? "Todos" : (TYPE_CONFIG[t]?.label ?? t)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Evento</label>
            <select
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
            >
              <option value="">Todos os eventos</option>
              {Object.entries(EVENT_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Log List */}
      <Card className="shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Log de envios</CardTitle>
          <Badge variant="secondary">{total} registros</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && [...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}

          {!isLoading && total === 0 && (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl text-muted-foreground text-center">
              <Bell className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Nenhuma notificação encontrada.</p>
            </div>
          )}

          {logs?.map((log) => {
            const typeCfg = TYPE_CONFIG[log.type] ?? TYPE_CONFIG.EMAIL;
            const eventCfg = EVENT_CONFIG[log.event] ?? { label: log.event, icon: <Bell className="h-3.5 w-3.5" /> };

            return (
              <div key={log.id} className="flex items-start gap-3 p-3.5 rounded-xl border bg-white dark:bg-card hover:bg-muted/30 transition-colors">
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", typeCfg.bg, typeCfg.color)}>
                  {typeCfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className="text-sm font-semibold">{typeCfg.label}</span>
                    <Badge variant="outline" className="text-xs flex items-center gap-1 py-0">
                      {eventCfg.icon} {eventCfg.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{log.recipient}</p>
                </div>
                <div className="text-right shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1 mb-1">
                    <Clock className="h-3 w-3" />
                    {dateTime(log.sentAt ?? log.createdAt)}
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Enviado</Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-2xl border bg-white dark:bg-card shadow-sm p-4 flex items-center gap-3">
      <div className="shrink-0 p-2 rounded-xl bg-muted/60">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-xl font-extrabold tracking-tight", color ?? "text-foreground")}>{value}</p>
      </div>
    </div>
  );
}
