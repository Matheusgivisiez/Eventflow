import { MapPin } from "lucide-react";
import type { EventFlowEvent } from "@/types/eventflow";

export function LocationMap({ event }: { event: EventFlowEvent }) {
  if (event.format === "ONLINE") {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Localizacao</h2>
        <div className="flex min-w-0 items-center gap-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MapPin className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="break-words font-medium text-foreground [overflow-wrap:anywhere]">Evento 100% Online</p>
            <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">O link de acesso sera enviado apos a confirmacao da compra.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Localizacao</h2>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="p-6">
          <p className="break-words font-medium text-foreground [overflow-wrap:anywhere]">{event.address}</p>
          <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {event.city}, {event.state} {event.zipCode && `- CEP: ${event.zipCode}`}
          </p>
          {event.mapUrl && (
            <a 
              className="mt-4 inline-flex text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline" 
              href={event.mapUrl} 
              target="_blank" 
              rel="noreferrer"
            >
              Ver no Google Maps &rarr;
            </a>
          )}
        </div>
        {/* Aqui poderiamos adicionar um iframe real do Google Maps se tivessemos a API Key ou o iframe URL */}
        <div className="h-48 w-full bg-muted flex items-center justify-center border-t">
          <MapPin className="h-8 w-8 text-muted-foreground/30" />
        </div>
      </div>
    </div>
  );
}
