"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, TicketCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { dateTime, money } from "@/lib/utils";
import type { EventHubEvent, Paginated } from "@/types/eventhub";

type Participant = {
  id: string;
  uuid: string;
  attendeeName: string;
  attendeeEmail: string;
  status: "AVAILABLE" | "USED" | "CANCELED";
  createdAt: string;
  usedAt?: string;
  event: { id: string; title: string; startsAt: string };
  ticketType: { id: string; name: string; priceCents: number };
  order: { id: string; buyerName: string; buyerEmail: string; totalCents: number; createdAt: string };
};

const statusLabel = {
  AVAILABLE: "Disponivel",
  USED: "Utilizado",
  CANCELED: "Cancelado"
};

export default function ParticipantsPage() {
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState("");
  const [status, setStatus] = useState("");

  const params = useMemo(() => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (eventId) query.set("eventId", eventId);
    if (status) query.set("status", status);
    query.set("perPage", "50");
    return query.toString();
  }, [search, eventId, status]);

  const events = useQuery({ queryKey: ["events-filter"], queryFn: () => api<Paginated<EventHubEvent>>("/events?perPage=100") });
  const participants = useQuery({
    queryKey: ["participants", params],
    queryFn: () => api<Paginated<Participant>>(`/participants?${params}`)
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Participantes</h1>
        <p className="text-sm text-muted-foreground">Consulte ingressos emitidos, status de entrada e dados do comprador.</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_240px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome, e-mail, evento ou lote" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={eventId} onChange={(event) => setEventId(event.target.value)}>
            <option value="">Todos os eventos</option>
            {events.data?.data.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos os status</option>
            <option value="AVAILABLE">Disponivel</option>
            <option value="USED">Utilizado</option>
            <option value="CANCELED">Cancelado</option>
          </select>
        </CardContent>
      </Card>

      {participants.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Ingressos emitidos</CardTitle>
            <Badge variant="secondary">{participants.data?.meta.total ?? 0} registros</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {participants.data?.data.length === 0 && (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-md border border-dashed text-center text-muted-foreground">
                <TicketCheck className="h-10 w-10" />
                <p className="mt-3 text-sm">Nenhum participante encontrado.</p>
              </div>
            )}
            {participants.data?.data.map((participant) => (
              <div key={participant.id} className="grid gap-3 rounded-md border p-3 text-sm lg:grid-cols-[1.2fr_1fr_140px_140px]">
                <div>
                  <p className="font-medium">{participant.attendeeName}</p>
                  <p className="text-muted-foreground">{participant.attendeeEmail}</p>
                </div>
                <div>
                  <p className="font-medium">{participant.event.title}</p>
                  <p className="text-muted-foreground">{participant.ticketType.name} · {money(participant.ticketType.priceCents)}</p>
                </div>
                <div>
                  <Badge variant={participant.status === "CANCELED" ? "destructive" : participant.status === "USED" ? "secondary" : "default"}>
                    {statusLabel[participant.status]}
                  </Badge>
                </div>
                <div className="text-muted-foreground">
                  {participant.usedAt ? dateTime(participant.usedAt) : dateTime(participant.createdAt)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {participants.error && <p className="text-sm text-destructive">{participants.error.message}</p>}
    </div>
  );
}
