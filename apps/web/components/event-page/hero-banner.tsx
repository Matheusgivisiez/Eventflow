"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dateTime, money } from "@/lib/utils";
import type { EventHubEvent } from "@/types/eventhub";

type HeroBannerProps = {
  event: EventHubEvent;
  minPrice: number;
};

export function HeroBanner({ event, minPrice }: HeroBannerProps) {
  const location = event.format === "ONLINE" ? "Evento online" : `${event.city ?? "Local nao definido"}${event.state ? `, ${event.state}` : ""}`;

  return (
    <section className="relative min-h-[60vh] overflow-hidden lg:min-h-[76vh]">
      {event.bannerUrl && <Image src={event.bannerUrl} alt={event.title} fill priority className="object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      <div className="relative flex min-h-[60vh] items-end px-5 py-10 text-white lg:min-h-[76vh] lg:px-16">
        <div className="max-w-4xl">
          <Badge className="bg-primary/90 text-primary-foreground backdrop-blur-sm hover:bg-primary">{event.category}</Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal lg:text-6xl lg:leading-tight">{event.title}</h1>
          <div className="mt-6 flex flex-wrap gap-5 text-sm font-medium text-white/90">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
              <CalendarDays className="h-5 w-5 text-primary" />
              {dateTime(event.startsAt)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
              <MapPin className="h-5 w-5 text-primary" />
              {location}
            </span>
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button asChild size="lg" className="h-14 px-8 text-lg font-semibold shadow-xl shadow-primary/25 transition-transform hover:scale-105">
              <Link href={`/checkout/${event.slug}`}>Garantir ingresso - {money(minPrice)}</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 border-white/30 bg-white/10 px-8 text-lg text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
              onClick={() => navigator.share?.({ title: event.title, url: window.location.href })}
            >
              <Share2 className="mr-2 h-5 w-5" />
              Compartilhar
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
