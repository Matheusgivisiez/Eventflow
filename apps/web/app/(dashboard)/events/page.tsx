"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, ExternalLink, Pencil, Search, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { dateTime, money } from "@/lib/utils";
import type { EventHubEvent, Paginated } from "@/types/eventhub";

const statusLabel: Record<string, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicado", CLOSED: "Encerrado" };
const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  CLOSED: "destructive"
};

export default function EventsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["events", search],
    queryFn: () => api<Paginated<EventHubEvent>>(`/events?search=${encodeURIComponent(search)}`)
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Eventos</h1>
          <p className="text-sm text-muted-foreground">Crie, publique e acompanhe seus eventos.</p>
        </div>
        <Button asChild>
          <Link href="/events/new">
            <CalendarPlus className="h-4 w-4" />
            Novo evento
          </Link>
        </Button>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, cidade ou categoria" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      {isLoading && <Skeleton className="h-80 w-full" />}
      {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error.message}</p>}
      <div className="grid gap-4">
        {data?.data.map((event) => (
          <Card key={event.id} className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{event.title}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {event.category} · {dateTime(event.startsAt)} · {event.city ?? "Online"}
                </p>
              </div>
              <Badge variant={statusVariant[event.status]}>{statusLabel[event.status]}</Badge>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-4">
              <Metric label="Lotes" value={event.ticketTypes.length} />
              <Metric label="Vendidos" value={event.ticketTypes.reduce((sum, ticket) => sum + ticket.sold, 0)} />
              <Metric label="Disponiveis" value={event.ticketTypes.reduce((sum, ticket) => sum + ticket.quantity - ticket.sold, 0)} />
              <Metric
                label="Menor preco"
                value={money(event.ticketTypes.length ? Math.min(...event.ticketTypes.map((ticket) => ticket.priceCents)) : 0)}
              />
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/events/${event.id}`}>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/events/${event.id}/tickets`}>
                  <Ticket className="h-3.5 w-3.5" />
                  Lotes ({event.ticketTypes.length})
                </Link>
              </Button>
              {event.status === "PUBLISHED" && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={`/eventos/${event.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Página pública
                  </a>
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
