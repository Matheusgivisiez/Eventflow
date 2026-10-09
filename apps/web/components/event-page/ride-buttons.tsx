"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { buildGoogleMapsLink, buildUberLink, buildWazeLink, getEventLocation } from "@/lib/ride-links";
import type { EventFlowEvent } from "@/types/eventflow";

const buttonClass =
  "glass-card h-11 gap-2 rounded-full border-0 bg-transparent px-4 text-foreground/90 transition-colors hover:bg-primary/10 hover:text-foreground";

/** Logo real da marca, carregada de /public/logos. */
function BrandLogo({ src, alt, size = 16 }: { src: string; alt: string; size?: number }) {
  return <Image src={src} alt={alt} width={size} height={size} className="shrink-0" unoptimized />;
}

export function RideButtons({ event }: { event: EventFlowEvent }) {
  const { address } = getEventLocation(event);

  if (!address) return null;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button asChild variant="outline" size="sm" className={buttonClass}>
        <a href={buildGoogleMapsLink(event)} target="_blank" rel="noreferrer">
          <BrandLogo src="/logos/google-maps.svg" alt="" size={16} />
          Google Maps
        </a>
      </Button>

      <Button asChild variant="outline" size="sm" className={buttonClass}>
        <a href={buildUberLink(event, event.title)} target="_blank" rel="noreferrer">
          <BrandLogo src="/logos/uber.webp" alt="" size={18} />
          Uber
        </a>
      </Button>

      <Button asChild variant="outline" size="sm" className={buttonClass}>
        <a href={buildWazeLink(event)} target="_blank" rel="noreferrer">
          <BrandLogo src="/logos/waze.webp" alt="" size={18} />
          Waze
        </a>
      </Button>
    </div>
  );
}
