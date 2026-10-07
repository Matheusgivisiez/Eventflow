"use client";

import { Clock, Minus, Plus, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUpcomingTicketLot, getVisibleTicketLots } from "@/lib/ticket-lots";
import { dateTime, money } from "@/lib/utils";
import type { TicketType } from "@/types/eventflow";

type TicketSelectorProps = {
  ticketTypes: TicketType[];
  /** Momento de referência para decidir qual lote está aberto (padrão: agora). */
  now?: Date;
  quantities: Record<string, number>;
  onQuantityChange: (ticketId: string, quantity: number) => void;
  attentionRequest?: number;
};

export function TicketSelector({
  ticketTypes,
  now,
  quantities,
  onQuantityChange,
  attentionRequest = 0
}: TicketSelectorProps) {
  const visibleLots = getVisibleTicketLots(ticketTypes, now);
  const upcomingLot = getUpcomingTicketLot(ticketTypes, now);
  const firstSelectableTicketId = visibleLots.find(({ status }) => status === "current")?.ticket.id;

  return (
    <section className="space-y-4" data-testid="ticket-selector">
      <div className="flex items-center gap-2">
        <Tag className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold tracking-tight">Ingressos</h2>
      </div>

      {upcomingLot && (
        <div
          data-testid="ticket-sales-upcoming"
          className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/[0.04] p-5"
        >
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">Vendas em breve</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Os ingressos serão liberados em <span className="font-medium text-foreground">{dateTime(upcomingLot.startsAt)}</span>.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {visibleLots.map(({ ticket, status, available, lotNumber }) => {
          const isSoldOut = status !== "current";
          const qty = quantities[ticket.id] ?? 0;
          const needsAttention = attentionRequest > 0 && ticket.id === firstSelectableTicketId && qty === 0;
          const selectionHintId = `ticket-selection-hint-${ticket.id}`;

          return (
            <div
              key={`${ticket.id}-${needsAttention ? attentionRequest : 0}`}
              data-testid={`ticket-card-${ticket.id}`}
              data-needs-attention={needsAttention ? "true" : undefined}
              className={`rounded-2xl border p-5 transition-all duration-200 ${
                isSoldOut
                  ? "border-dashed bg-muted/30 opacity-60 cursor-not-allowed"
                  : qty > 0
                    ? "border-primary/40 bg-primary/[0.03] shadow-sm"
                    : needsAttention
                      ? "ticket-selection-attention border-primary bg-primary/[0.07] shadow-lg shadow-primary/15 ring-4 ring-primary/15"
                    : "bg-white dark:bg-card hover:border-primary/30 hover:shadow-sm"
              }`}
            >
              {/* Lote badge */}
              <div className="flex items-center justify-between mb-3">
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold ${
                    isSoldOut
                      ? "border-destructive/40 text-destructive"
                      : "border-primary/30 text-primary"
                  }`}
                >
                  {`${lotNumber}º Lote`}
                </Badge>
                {isSoldOut && (
                  <Badge variant="destructive" className="text-xs">
                    Esgotado
                  </Badge>
                )}
              </div>

              <div className="flex items-start justify-between gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="break-words text-base font-semibold text-foreground [overflow-wrap:anywhere]">{ticket.name}</p>
                  {ticket.description && (
                    <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere] line-clamp-2">
                      {ticket.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {!isSoldOut && (
                      <span>Máx. {ticket.limitPerBuy} por compra</span>
                    )}
                    {isSoldOut && (
                      <span>Este lote foi encerrado</span>
                    )}
                  </div>
                </div>

                {/* Preço + Seletor */}
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <p className="text-xl font-bold text-primary">
                    {ticket.priceCents === 0 ? "Gratuito" : money(ticket.priceCents)}
                  </p>

                  {!isSoldOut && (
                    <div className="flex flex-col items-end gap-2">
                      {needsAttention && (
                        <p
                          id={selectionHintId}
                          role="status"
                          className="animate-slide-down text-right text-xs font-semibold text-primary"
                        >
                          Clique no + para adicionar
                        </p>
                      )}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 rounded-lg border-border/60 transition-colors hover:border-primary/50 hover:text-primary sm:h-8 sm:w-8"
                          disabled={qty <= 0}
                          aria-label={`Remover um ingresso ${ticket.name}`}
                          onClick={() => onQuantityChange(ticket.id, Math.max(0, qty - 1))}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">
                          {qty}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          data-ticket-add
                          className={`h-11 w-11 rounded-lg transition-all sm:h-8 sm:w-8 ${
                            needsAttention
                              ? "ticket-add-attention border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:text-primary-foreground"
                              : "border-border/60 hover:border-primary/50 hover:text-primary"
                          }`}
                          disabled={qty >= Math.min(available, ticket.limitPerBuy)}
                          aria-label={`Adicionar um ingresso ${ticket.name}`}
                          aria-describedby={needsAttention ? selectionHintId : undefined}
                          onClick={() =>
                            onQuantityChange(
                              ticket.id,
                              Math.min(qty + 1, available, ticket.limitPerBuy)
                            )
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
