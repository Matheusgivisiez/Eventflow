"use client";

import { useMemo, useState } from "react";
import { TicketSelector } from "@/components/event-page/ticket-selector";
import { FloatingBuyBar } from "@/components/event-page/floating-buy-bar";
import { ShareButtons } from "@/components/event-page/share-buttons";
import { EventArtists } from "@/components/event-page/event-artists";
import type { EventFlowEvent } from "@/types/eventflow";

type EventDetailClientProps = {
  event: EventFlowEvent;
};

export function EventDetailClient({ event }: EventDetailClientProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleQuantityChange = (ticketId: string, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [ticketId]: quantity }));
  };

  const { totalCents, totalItems } = useMemo(() => {
    let cents = 0;
    let items = 0;

    for (const ticket of event.ticketTypes) {
      const qty = quantities[ticket.id] ?? 0;
      cents += qty * ticket.priceCents;
      items += qty;
    }

    return { totalCents: cents, totalItems: items };
  }, [event.ticketTypes, quantities]);

  return (
    <>
      {/* Sticky sidebar com ingressos + compartilhar */}
      <div className="sticky top-20 space-y-6">
        {/* Compartilhar */}
        <ShareButtons title={event.title} slug={event.slug} />

        {/* Seletor de ingressos */}
        <TicketSelector
          ticketTypes={event.ticketTypes}
          quantities={quantities}
          onQuantityChange={handleQuantityChange}
        />

        <EventArtists artists={event.artists} compact />
      </div>

      {/* Barra fixa de compra */}
      <FloatingBuyBar
        slug={event.slug}
        totalCents={totalCents}
        totalItems={totalItems}
        selectedItems={quantities}
      />
    </>
  );
}
