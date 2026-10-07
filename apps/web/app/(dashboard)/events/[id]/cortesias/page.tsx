"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CourtesyManager } from "@/components/courtesy/courtesy-manager";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { EventFlowEvent } from "@/types/eventflow";

export default function EventCourtesyPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const { data: event, isLoading } = useQuery<EventFlowEvent>({
    queryKey: ["event", eventId],
    queryFn: () => api<EventFlowEvent>(`/events/${eventId}`)
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/events/${eventId}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Cortesias</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {event ? `${event.title}: ` : ""}ingressos que você emite para seus convidados, sem cobrança e fora dos lotes.
          </p>
        </div>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}

      {event && event.accessRole !== "OWNER" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Somente quem criou o evento pode emitir cortesias.
        </p>
      )}

      {event?.accessRole === "OWNER" && (
        <CourtesyManager
          queryKey={["event-courtesy", eventId]}
          listUrl={`/events/${eventId}/courtesy`}
          issueUrl={`/events/${eventId}/courtesy`}
          cancelUrl={(ticketId) => `/events/${eventId}/courtesy/${ticketId}/cancel`}
          defaultLabel="Cortesia"
          issueTitle="Emitir cortesia"
          issueDescription="Cada convidado recebe o ingresso por e-mail, com QR Code válido na portaria. A cortesia é nominal (não pode ser transferida), não consome o estoque dos lotes e não entra nos números de venda: ela aparece aqui, em contagem separada."
        />
      )}
    </div>
  );
}
