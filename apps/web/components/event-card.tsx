"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, Ticket, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dateTime, money } from "@/lib/utils";
import type { EventFlowEvent } from "@/types/eventflow";

interface EventCardProps {
  event: EventFlowEvent;
}

export function EventCard({ event }: EventCardProps) {
  const activeTicketTypes = event.ticketTypes?.filter((ticket) => ticket.isActive) ?? [];
  const minPrice = activeTicketTypes.length ? Math.min(...activeTicketTypes.map((ticket) => ticket.priceCents)) : null;
  const location = event.format === "ONLINE" ? "Evento online" : `${event.city ?? "Local não definido"}${event.state ? `, ${event.state}` : ""}`;

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-white dark:bg-card shadow-sm card-hover">
      {/* Banner */}
      <div className="relative h-44 w-full overflow-hidden bg-muted">
        {event.bannerUrl ? (
          <Image
            src={event.bannerUrl}
            alt={event.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            quality={80}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 transition-colors duration-300 group-hover:from-primary/15 group-hover:to-primary/10">
            <Ticket className="h-12 w-12 text-primary/40 stroke-[1.5] transition-transform duration-300 group-hover:scale-110" />
          </div>
        )}
        {/* Badges sobrepostos */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge className="bg-white/95 text-foreground shadow-sm text-xs border-0">
            {event.category || "Geral"}
          </Badge>
          {event.format === "ONLINE" && (
            <Badge className="bg-primary text-white shadow-sm text-xs border-0">Online</Badge>
          )}
        </div>
        {/* Preço sobreposto */}
        {minPrice !== null && (
          <div className="absolute right-3 bottom-3">
            <div className="rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-white shadow-md">
              {minPrice === 0 ? "Gratuito" : `a partir de ${money(minPrice)}`}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-grow p-4">
        <h3 className="line-clamp-2 text-base font-bold leading-tight text-foreground group-hover:text-primary transition-colors mb-3">
          <Link href={`/eventos/${event.slug}`}>{event.title}</Link>
        </h3>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary/75 shrink-0" />
            <span>{dateTime(event.startsAt)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary/75 shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <Button asChild size="sm" className="w-full bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-xl shadow-sm shadow-primary/20">
            <Link href={`/eventos/${event.slug}`}>
              Ver evento
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
