"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { dateTime } from "@/lib/utils";
import type { EventHubEvent } from "@/types/eventhub";

type HeroBannerProps = {
  event: EventHubEvent;
};

export function HeroBanner({ event }: HeroBannerProps) {
  const location =
    event.format === "ONLINE"
      ? "Evento online"
      : `${event.address ?? event.city ?? "Local não definido"}${event.city ? ` - ${event.city}` : ""}${event.state ? `/${event.state}` : ""}`;

  return (
    <section className="relative overflow-hidden">
      {/* Top navigation bar */}
      <div className="sticky top-0 z-40 glass border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-8">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>

          <Link href="/" className="group hover:opacity-90 transition-opacity">
            <BrandLogo />
          </Link>

          <Button asChild variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors rounded-full">
            <Link href="/login">Entrar</Link>
          </Button>
        </div>
      </div>

      {/* Banner image */}
      <div className="relative w-full aspect-[16/7] sm:aspect-[16/6] lg:aspect-[16/5] max-h-[480px] overflow-hidden bg-muted">
        {event.bannerUrl ? (
          <Image
            src={event.bannerUrl}
            alt={event.title}
            fill
            priority
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Ticket className="h-20 w-20 text-primary/30 stroke-[1]" />
          </div>
        )}
      </div>

      {/* Event info */}
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="py-6 space-y-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl animate-slide-up">
            {event.title}
          </h1>

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-4 py-2 font-medium">
              <CalendarDays className="h-4 w-4 text-primary" />
              {dateTime(event.startsAt)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-4 py-2 font-medium">
              <MapPin className="h-4 w-4 text-primary" />
              {location}
            </span>
          </div>

          {event.category && (
            <div className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                {event.category}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
