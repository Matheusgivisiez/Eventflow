"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TicketSelector } from "@/components/event-page/ticket-selector";
import { FloatingBuyBar } from "@/components/event-page/floating-buy-bar";
import { ShareButtons } from "@/components/event-page/share-buttons";
import { EventArtists } from "@/components/event-page/event-artists";
import { getCurrentTicketLots } from "@/lib/ticket-lots";
import type { EventFlowEvent } from "@/types/eventflow";

type EventDetailClientProps = {
  event: EventFlowEvent;
  aboutSection: ReactNode;
  gallerySection: ReactNode;
  locationSection: ReactNode;
  agendaSection: ReactNode;
  faqSection: ReactNode;
  organizerSection: ReactNode;
};

export function EventDetailClient({
  event,
  aboutSection,
  gallerySection,
  locationSection,
  agendaSection,
  faqSection,
  organizerSection
}: EventDetailClientProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const mobileTicketsRef = useRef<HTMLDivElement>(null);
  const desktopTicketsRef = useRef<HTMLDivElement>(null);

  const handleQuantityChange = (ticketId: string, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [ticketId]: quantity }));
  };

  const currentTicketIds = useMemo(
    () => new Set(getCurrentTicketLots(event.ticketTypes).map(({ ticket }) => ticket.id)),
    [event.ticketTypes],
  );
  const purchasableQuantities = useMemo(
    () => Object.fromEntries(Object.entries(quantities).filter(([ticketId, quantity]) => currentTicketIds.has(ticketId) && quantity > 0)),
    [currentTicketIds, quantities],
  );

  useEffect(() => {
    setQuantities((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([ticketId, quantity]) => currentTicketIds.has(ticketId) && quantity > 0));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [currentTicketIds]);

  const { totalCents, totalItems } = useMemo(() => {
    let cents = 0;
    let items = 0;

    for (const ticket of event.ticketTypes) {
      const qty = purchasableQuantities[ticket.id] ?? 0;
      cents += qty * ticket.priceCents;
      items += qty;
    }

    return { totalCents: cents, totalItems: items };
  }, [event.ticketTypes, purchasableQuantities]);

  // Sem ingresso selecionado, o botão "Garantir" leva até o seletor em vez de ficar inerte.
  function scrollToTickets() {
    const mobileEl = mobileTicketsRef.current;
    const desktopEl = desktopTicketsRef.current;
    const isMobileVisible = mobileEl !== null && mobileEl.offsetParent !== null;
    const target = isMobileVisible ? mobileEl : desktopEl;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const ticketsAndArtists = (
    <>
      <ShareButtons title={event.title} slug={event.slug} />
      <TicketSelector
        ticketTypes={event.ticketTypes}
        quantities={quantities}
        onQuantityChange={handleQuantityChange}
      />
      <EventArtists artists={event.artists} compact />
    </>
  );

  return (
    <>
      <div className="grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-12">
        {/* Coluna esquerda: informações */}
        <div className="min-w-0 space-y-10 sm:space-y-12">
          {aboutSection}

          {/* No mobile, ingressos + artistas vêm logo após o resumo do evento,
              antes de galeria/localização/agenda (no desktop isso vira a sidebar abaixo) */}
          <div ref={mobileTicketsRef} className="space-y-6 lg:hidden">
            {ticketsAndArtists}
          </div>

          {gallerySection}
          {locationSection}
          {agendaSection}
          {faqSection}
          {organizerSection}
        </div>

        {/* Coluna direita: sidebar sticky com ingressos (somente desktop) */}
        <div className="relative hidden min-w-0 lg:block">
          <div ref={desktopTicketsRef} className="sticky top-20 space-y-6">
            {ticketsAndArtists}
          </div>
        </div>
      </div>

      {/* Barra fixa de compra */}
      <FloatingBuyBar
        slug={event.slug}
        totalCents={totalCents}
        totalItems={totalItems}
        selectedItems={purchasableQuantities}
        onEmptySelectionClick={scrollToTickets}
      />
    </>
  );
}
