"use client";

import { useState } from "react";
import { Car, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildGoogleMapsLink,
  buildUberLink,
  buildWazeLink,
  getEventLocation,
  NINETYNINE_ANDROID_STORE,
  NINETYNINE_APP_SCHEME,
  NINETYNINE_IOS_STORE,
  NINETYNINE_WEB_FALLBACK,
} from "@/lib/ride-links";
import type { EventFlowEvent } from "@/types/eventflow";

const buttonClass =
  "gap-2 rounded-full border-border/60 hover:border-primary/50 hover:text-primary transition-colors";

export function RideButtons({ event }: { event: EventFlowEvent }) {
  const [addressCopied, setAddressCopied] = useState(false);
  const { address } = getEventLocation(event);

  if (!address) return null;

  const handle99Click = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 3000);
    } catch {
      /* clipboard indisponivel neste navegador */
    }

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);

    if (isAndroid || isIOS) {
      // Tenta abrir o app instalado; se nao abrir, cai pra loja certa.
      window.location.href = NINETYNINE_APP_SCHEME;
      setTimeout(() => {
        window.location.href = isAndroid ? NINETYNINE_ANDROID_STORE : NINETYNINE_IOS_STORE;
      }, 1500);
    } else {
      window.open(NINETYNINE_WEB_FALLBACK, "_blank", "noreferrer");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm" className={buttonClass}>
        <a href={buildGoogleMapsLink(event)} target="_blank" rel="noreferrer">
          <MapPin className="h-4 w-4" />
          Google Maps
        </a>
      </Button>

      <Button asChild variant="outline" size="sm" className={buttonClass}>
        <a href={buildUberLink(event, event.title)} target="_blank" rel="noreferrer">
          <Car className="h-4 w-4" />
          Uber
        </a>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className={buttonClass}
        onClick={handle99Click}
        title="O 99 não tem link de destino direto — o endereço é copiado para você colar no app."
      >
        <Car className="h-4 w-4" />
        {addressCopied ? "Endereço copiado!" : "99"}
      </Button>

      <Button asChild variant="outline" size="sm" className={buttonClass}>
        <a href={buildWazeLink(event)} target="_blank" rel="noreferrer">
          <Navigation className="h-4 w-4" />
          Waze
        </a>
      </Button>
    </div>
  );
}
