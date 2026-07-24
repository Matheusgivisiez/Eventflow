"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Calendar, CheckCircle2, Clock, History, Send, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { dateTime } from "@/lib/utils";

type TransferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";

type Transfer = {
  id: string;
  status: TransferStatus;
  createdAt: string;
  acceptedAt?: string;
  declinedAt?: string;
  cancelledAt?: string;
  receiverEmail?: string;
  receiverCpf?: string;
  sender: { id: string; name: string; email: string };
  receiver?: { id: string; name: string; email: string };
  ticket: {
    event: { title: string; slug: string; startsAt: string };
    ticketType: { name: string };
  };
};

const statusConfig: Record<TransferStatus, { label: string; icon: typeof Clock; className: string }> = {
  PENDING: { label: "Pendente", icon: Clock, className: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300" },
  ACCEPTED: { label: "Aceita", icon: CheckCircle2, className: "border-green-200 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300" },
  DECLINED: { label: "Recusada", icon: XCircle, className: "border-red-200 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" },
  EXPIRED: { label: "Expirada", icon: Clock, className: "border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300" },
  CANCELLED: { label: "Cancelada", icon: XCircle, className: "border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300" }
};

export default function TransferHistoryPage() {
  const user = useAuthStore((state) => state.user);
  const history = useQuery({
    queryKey: ["transfer-history"],
    queryFn: () => api<Transfer[]>("/transfers/history")
  });

  return (
    <main className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold">Historico de transferencias</h2>
        <p className="text-sm text-muted-foreground">Acompanhe ingressos enviados e recebidos.</p>
      </div>

      {history.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-2xl border bg-white p-4 dark:bg-card">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : history.data?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white py-16 text-center dark:bg-card">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <History className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold">Nenhuma transferencia registrada</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Seu historico ficara disponivel depois da primeira transferencia.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.data?.map((transfer) => {
            const cfg = statusConfig[transfer.status];
            const StatusIcon = cfg.icon;
            const sentByMe = transfer.sender.id === user?.id;
            const counterparty = sentByMe
              ? transfer.receiver?.name ?? transfer.receiverEmail ?? transfer.receiverCpf ?? "Destinatario convidado"
              : transfer.sender.name;

            return (
              <article key={transfer.id} className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase text-primary">
                      <Send className="h-3.5 w-3.5" />
                      {sentByMe ? `Transferido para ${counterparty}` : `Recebido de ${counterparty}`}
                    </p>
                    <h3 className="text-base font-bold">
                      <Link href={`/eventos/${transfer.ticket.event.slug}`} className="hover:text-primary">
                        {transfer.ticket.event.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{transfer.ticket.ticketType.name}</p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 text-primary/75" />
                      Criada em {dateTime(transfer.createdAt)}
                    </p>
                  </div>

                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.className}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
