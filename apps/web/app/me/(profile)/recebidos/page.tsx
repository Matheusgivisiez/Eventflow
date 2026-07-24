"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Calendar, Check, Inbox, Loader2, Send, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dateTime } from "@/lib/utils";

type Transfer = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";
  createdAt: string;
  sender: { name: string; email: string };
  ticket: {
    event: { title: string; slug: string; startsAt: string; city?: string; state?: string };
    ticketType: { name: string };
  };
};

export default function ReceivedTicketsPage() {
  const transfers = useQuery({
    queryKey: ["received-transfers"],
    queryFn: () => api<Transfer[]>("/transfers?status=PENDING")
  });

  const accept = useMutation({
    mutationFn: (id: string) => api(`/transfers/${id}/accept`, { method: "POST" }),
    onSuccess: () => transfers.refetch()
  });

  const reject = useMutation({
    mutationFn: (id: string) => api(`/transfers/${id}/reject`, { method: "POST" }),
    onSuccess: () => transfers.refetch()
  });

  const busyId = accept.variables ?? reject.variables;

  return (
    <main className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold">Ingressos recebidos</h2>
        <p className="text-sm text-muted-foreground">Aceite ou recuse transferencias pendentes enviadas para voce.</p>
      </div>

      {transfers.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-2xl border bg-white p-4 dark:bg-card">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-1/2" />
              <Skeleton className="mt-4 h-9 w-full" />
            </div>
          ))}
        </div>
      ) : transfers.data?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white py-16 text-center dark:bg-card">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Inbox className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold">Nenhuma transferencia pendente</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Quando alguem enviar um ingresso para voce, ele aparecera aqui.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transfers.data?.map((transfer) => (
            <article key={transfer.id} className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase text-primary">
                    <Send className="h-3.5 w-3.5" />
                    Enviado por {transfer.sender.name}
                  </p>
                  <h3 className="text-base font-bold">
                    <Link href={`/eventos/${transfer.ticket.event.slug}`} className="hover:text-primary">
                      {transfer.ticket.event.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{transfer.ticket.ticketType.name}</p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary/75" />
                    {dateTime(transfer.ticket.event.startsAt)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:min-w-56">
                  <Button
                    className="rounded-xl"
                    disabled={busyId === transfer.id}
                    onClick={() => accept.mutate(transfer.id)}
                  >
                    {accept.isPending && accept.variables === transfer.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Aceitar
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={busyId === transfer.id}
                    onClick={() => reject.mutate(transfer.id)}
                  >
                    {reject.isPending && reject.variables === transfer.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                    Recusar
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {(accept.isError || reject.isError) && (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {((accept.error ?? reject.error) as Error).message}
        </p>
      )}
    </main>
  );
}
