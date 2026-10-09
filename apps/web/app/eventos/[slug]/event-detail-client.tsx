"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TicketSelector } from "@/components/event-page/ticket-selector";
import { FloatingBuyBar } from "@/components/event-page/floating-buy-bar";
import { ShareButtons } from "@/components/event-page/share-buttons";
import { EventArtists } from "@/components/event-page/event-artists";
import { getCurrentTicketLots, getUpcomingTicketLot } from "@/lib/ticket-lots";
import type { EventFlowEvent } from "@/types/eventflow";

type EventDetailClientProps = {
  event: EventFlowEvent;
  invite?: string;
  aboutSection: ReactNode;
  venueMapSection: ReactNode;
  gallerySection: ReactNode;
  locationSection: ReactNode;
  agendaSection: ReactNode;
  faqSection: ReactNode;
  organizerSection: ReactNode;
};

export function EventDetailClient({
  event,
  invite,
  aboutSection,
  venueMapSection,
  gallerySection,
  locationSection,
  agendaSection,
  faqSection,
  organizerSection
}: EventDetailClientProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [ticketAttentionRequest, setTicketAttentionRequest] = useState(0);
  const mobileTicketsRef = useRef<HTMLDivElement>(null);
  const desktopTicketsRef = useRef<HTMLDivElement>(null);

  const handleQuantityChange = (ticketId: string, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [ticketId]: quantity }));
  };

  // Relógio da página: avança sozinho no horário de abertura do lote programado,
  // para quem está esperando na página ver o ingresso liberar sem recarregar.
  const [now, setNow] = useState(() => new Date());
  const upcomingLotStartsAt = useMemo(
    () => getUpcomingTicketLot(event.ticketTypes, now)?.startsAt ?? null,
    [event.ticketTypes, now],
  );

  useEffect(() => {
    if (!upcomingLotStartsAt) return;
    // setTimeout aceita no máximo ~24,8 dias; acima disso reagenda ao disparar.
    const delay = Math.min(Math.max(0, new Date(upcomingLotStartsAt).getTime() - Date.now()) + 500, 2_000_000_000);
    const timer = window.setTimeout(() => setNow(new Date()), delay);
    return () => window.clearTimeout(timer);
  }, [upcomingLotStartsAt, now]);

  const currentTicketIds = useMemo(
    () => new Set(getCurrentTicketLots(event.ticketTypes, now).map(({ ticket }) => ticket.id)),
    [event.ticketTypes, now],
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
    setTicketAttentionRequest((request) => request + 1);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });

    // Depois da rolagem, o foco reforça qual controle adiciona o ingresso.
    window.setTimeout(() => {
      target
        ?.querySelector<HTMLButtonElement>("[data-ticket-add]")
        ?.focus({ preventScroll: true });
    }, 450);
  }

  const ticketSelector = (
    <TicketSelector
      ticketTypes={event.ticketTypes}
      now={now}
      quantities={quantities}
      onQuantityChange={handleQuantityChange}
      attentionRequest={ticketAttentionRequest}
    />
  );

  return (
    <>
      <div className="grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-12">
        {/* Coluna esquerda: informações */}
        <div className="min-w-0 space-y-10 sm:space-y-12">
          {/* No mobile, o seletor vem logo após a capa e os dados do evento. */}
          <div ref={mobileTicketsRef} className="scroll-mt-24 space-y-6 lg:hidden">
            {ticketSelector}
          </div>

          {aboutSection}

          <div className="space-y-6 lg:hidden">
            <ShareButtons title={event.title} slug={event.slug} invite={invite} />
            <EventArtists artists={event.artists} compact />
          </div>

          {venueMapSection}
          {gallerySection}
          {locationSection}
          {agendaSection}
          {faqSection}
          {organizerSection}
        </div>

        {/* Coluna direita: sidebar sticky com ingressos (somente desktop) */}
        <div className="relative hidden min-w-0 lg:block">
          <div ref={desktopTicketsRef} className="sticky top-20 scroll-mt-24 space-y-6">
            <ShareButtons title={event.title} slug={event.slug} invite={invite} />
            {ticketSelector}
            <EventArtists artists={event.artists} compact />
          </div>
        </div>
      </div>

      {/* Barra fixa de compra */}
      <FloatingBuyBar
        slug={event.slug}
        invite={invite}
        totalCents={totalCents}
        totalItems={totalItems}
        selectedItems={purchasableQuantities}
        onEmptySelectionClick={scrollToTickets}
      />
    </>
  );
}
