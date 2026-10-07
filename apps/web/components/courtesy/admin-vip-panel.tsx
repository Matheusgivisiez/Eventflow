"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CourtesyManager } from "@/components/courtesy/courtesy-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

type AdminEventOption = {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  tenant?: { name: string };
  owner?: { name: string; email: string };
};

type CourtesyCounts = {
  eventId: string;
  platformIssued: number;
  platformCheckedIn: number;
  organizerIssued: number;
  organizerCheckedIn: number;
};

type View = "PLATFORM_COURTESY" | "ORGANIZER_COURTESY";

/**
 * Aba do painel admin para os convidados da Eventflow. O admin escolhe
 * qualquer evento da plataforma e emite ingressos VIP que o organizador
 * daquele evento não enxerga em nenhuma tela. Também permite auditar, só
 * para leitura, as cortesias que o próprio organizador emitiu.
 */
export function AdminVipPanel({ events, loading }: { events: AdminEventOption[]; loading: boolean }) {
  const [eventId, setEventId] = useState("");
  const [view, setView] = useState<View>("PLATFORM_COURTESY");

  const counts = useQuery({
    queryKey: ["admin-courtesy-summary"],
    queryFn: () => api<CourtesyCounts[]>("/admin/courtesy/summary")
  });
  const countsByEvent = useMemo(() => new Map((counts.data ?? []).map((row) => [row.eventId, row])), [counts.data]);

  const options = useMemo(
    () => [...events].sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    [events]
  );
  const selected = options.find((event) => event.id === eventId);
  const selectedCounts = eventId ? countsByEvent.get(eventId) : undefined;

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Convidados VIP da Eventflow</CardTitle>
          <CardDescription>
            Ingressos especiais emitidos pela plataforma em qualquer evento. Valem na portaria como qualquer ingresso,
            mas não aparecem para o organizador: ficam fora de vendidos, participantes, check-ins e relatórios dele.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-vip-event">Evento</Label>
            <select
              id="admin-vip-event"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              disabled={loading}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{loading ? "Carregando eventos…" : "Selecione um evento"}</option>
              {options.map((event) => {
                const row = countsByEvent.get(event.id);
                return (
                  <option key={event.id} value={event.id}>
                    {event.title} · {event.tenant?.name ?? event.owner?.name ?? "sem organizador"} · {new Date(event.startsAt).toLocaleDateString("pt-BR")}
                    {row?.platformIssued ? ` · ${row.platformIssued} VIP` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {selected && (
            <div className="flex flex-wrap gap-2">
              <ViewButton active={view === "PLATFORM_COURTESY"} onClick={() => setView("PLATFORM_COURTESY")}>
                VIP Eventflow ({selectedCounts?.platformIssued ?? 0})
              </ViewButton>
              <ViewButton active={view === "ORGANIZER_COURTESY"} onClick={() => setView("ORGANIZER_COURTESY")}>
                Cortesias do organizador ({selectedCounts?.organizerIssued ?? 0})
              </ViewButton>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && view === "PLATFORM_COURTESY" && (
        <CourtesyManager
          key={`${selected.id}-platform`}
          queryKey={["admin-courtesy", selected.id, "PLATFORM_COURTESY"]}
          listUrl={`/admin/courtesy/events/${selected.id}`}
          issueUrl={`/admin/courtesy/events/${selected.id}`}
          cancelUrl={(ticketId) => `/admin/courtesy/tickets/${ticketId}/cancel`}
          defaultLabel="Convidado VIP"
          issueTitle={`Emitir VIP para ${selected.title}`}
          issueDescription="Cada convidado recebe o ingresso por e-mail, com QR Code válido na portaria. O ingresso é nominal (não pode ser transferido) e não consome o estoque de nenhum lote do organizador."
        />
      )}

      {selected && view === "ORGANIZER_COURTESY" && (
        <CourtesyManager
          key={`${selected.id}-organizer`}
          readOnly
          queryKey={["admin-courtesy", selected.id, "ORGANIZER_COURTESY"]}
          listUrl={`/admin/courtesy/events/${selected.id}?origin=ORGANIZER_COURTESY`}
          issueUrl=""
          cancelUrl={() => ""}
          defaultLabel="Cortesia"
          issueTitle=""
          issueDescription=""
        />
      )}
    </div>
  );
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}
