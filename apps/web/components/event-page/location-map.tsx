import { MapPin } from "lucide-react";
import type { EventFlowEvent } from "@/types/eventflow";
import { buildGoogleMapsLink, buildMapEmbedSrc, getEventLocation } from "@/lib/ride-links";
import { RideButtons } from "@/components/event-page/ride-buttons";

export function LocationMap({ event }: { event: EventFlowEvent }) {
  if (event.format === "ONLINE") {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Localização</h2>
        <div className="glass-card flex min-w-0 items-center gap-4 rounded-3xl p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <MapPin className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="break-words font-medium text-foreground [overflow-wrap:anywhere]">Evento 100% Online</p>
            <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">O link de acesso será enviado após a confirmação da compra.</p>
          </div>
        </div>
      </div>
    );
  }

  const { address } = getEventLocation(event);
  const mapEmbedSrc = buildMapEmbedSrc(event);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Localização</h2>
      <div className="glass-card overflow-hidden rounded-3xl">
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <p className="break-words text-lg font-bold tracking-tight text-foreground [overflow-wrap:anywhere]">{event.address}</p>
            <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {event.city}, {event.state} {event.zipCode && `- CEP: ${event.zipCode}`}
            </p>
            {event.mapUrl && (
              <a
                className="mt-2 inline-flex text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                href={buildGoogleMapsLink(event)}
                target="_blank"
                rel="noreferrer"
              >
                Ver no Google Maps &rarr;
              </a>
            )}
          </div>

          <RideButtons event={event} />
        </div>

        {/* Mapa recuado dentro do card, com cantos próprios. */}
        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          {mapEmbedSrc ? (
            <iframe
              src={mapEmbedSrc}
              title={`Mapa: ${address}`}
              className="block h-60 w-full rounded-2xl sm:h-64"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-2xl bg-muted/60">
              <MapPin className="h-8 w-8 text-muted-foreground/30" strokeWidth={1.75} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
