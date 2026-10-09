"use client";

import { Clock, Minus, Plus, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUpcomingTicketLot, getVisibleTicketLots } from "@/lib/ticket-lots";
import { dateTime, money } from "@/lib/utils";
import type { TicketType } from "@/types/eventflow";

// Só no tema claro (o escuro já separa bem): o lote ativo fica branco com contorno e
// sombra; o esgotado, num cinza um tom abaixo do fundo, com borda tracejada mais
// visível, para nenhum dos dois se misturar com a página.
const LIGHT_ACTIVE =
  "[html:not(.dark)_&]:bg-white [html:not(.dark)_&]:ring-1 [html:not(.dark)_&]:ring-foreground/10 [html:not(.dark)_&]:shadow-[0_10px_28px_-16px_hsl(var(--foreground)/0.3)]";
const LIGHT_SOLD_OUT =
  "[html:not(.dark)_&]:border-foreground/25 [html:not(.dark)_&]:bg-muted/70 [html:not(.dark)_&]:shadow-[0_1px_2px_hsl(var(--foreground)/0.06),0_6px_16px_-12px_hsl(var(--foreground)/0.25)]";

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
  // Só a ordem de exibição muda: lotes à venda primeiro (na ordem dos lotes), os
  // encerrados depois. A numeração (lotLabel) continua a calculada por getVisibleTicketLots.
  const allLots = getVisibleTicketLots(ticketTypes, now);
  const visibleLots = [...allLots.filter(({ status }) => status === "current"), ...allLots.filter(({ status }) => status !== "current")];
  const upcomingLot = getUpcomingTicketLot(ticketTypes, now);
  const firstSelectableTicketId = visibleLots.find(({ status }) => status === "current")?.ticket.id;

  return (
    <section className="space-y-4" data-testid="ticket-selector">
      <div className="flex items-center gap-2.5">
        <Tag className="h-6 w-6 text-primary" strokeWidth={1.75} />
        <h2 className="text-2xl font-bold tracking-tight">Ingressos</h2>
      </div>

      {upcomingLot && (
        <div
          data-testid="ticket-sales-upcoming"
          className="glass-card flex items-start gap-3 rounded-2xl p-5"
        >
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">Vendas em breve</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Os ingressos serão liberados em <span className="font-medium text-foreground">{dateTime(upcomingLot.startsAt)}</span>.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {visibleLots.map(({ ticket, status, available, lotLabel }) => {
          const isSoldOut = status !== "current";
          const qty = quantities[ticket.id] ?? 0;
          const needsAttention = attentionRequest > 0 && ticket.id === firstSelectableTicketId && qty === 0;
          const selectionHintId = `ticket-selection-hint-${ticket.id}`;

          // Lote encerrado: linha compacta com nome, selo e preço, para não alongar a rolagem.
          if (isSoldOut) {
            return (
              <div
                key={ticket.id}
                data-testid={`ticket-card-${ticket.id}`}
                aria-disabled="true"
                className={`flex cursor-not-allowed items-center justify-between gap-3 rounded-2xl border border-dashed border-foreground/15 bg-card/30 px-4 py-4 ${LIGHT_SOLD_OUT}`}
              >
                <p className="min-w-0 break-words text-[0.9375rem] font-semibold text-foreground/60 [overflow-wrap:anywhere]">{ticket.name}</p>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant="destructive" className="rounded-lg px-2.5 py-0.5 text-xs font-semibold">
                    Esgotado
                  </Badge>
                  {/* Preço riscado, mais fino e apagado: o lote acabou. */}
                  <p className="whitespace-nowrap text-base font-medium text-muted-foreground/70 line-through decoration-muted-foreground/60 decoration-1">
                    {ticket.priceCents === 0 ? "Gratuito" : money(ticket.priceCents)}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={`${ticket.id}-${needsAttention ? attentionRequest : 0}`}
              data-testid={`ticket-card-${ticket.id}`}
              data-needs-attention={needsAttention ? "true" : undefined}
              className={`glass-card rounded-2xl p-4 transition-all duration-200 ${
                qty > 0
                  ? "bg-primary/[0.04] ring-1 ring-primary/50 shadow-lg shadow-primary/10"
                  : needsAttention
                    ? "ticket-selection-attention bg-primary/[0.07] ring-2 ring-primary ring-offset-0 shadow-[0_0_0_6px_hsl(var(--primary)/0.18),0_12px_32px_-8px_hsl(var(--primary)/0.45)]"
                    : `hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 ${LIGHT_ACTIVE}`
              }`}
            >
              {/* Etiqueta do lote: segue o nome que o produtor deu (ver buildLotLabels) */}
              {lotLabel && (
                <div className="mb-2 flex items-center">
                  <Badge
                    variant="outline"
                    data-testid={`ticket-lot-label-${ticket.id}`}
                    className="rounded-lg border-primary/30 text-xs font-semibold text-primary"
                  >
                    {lotLabel}
                  </Badge>
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="break-words text-base font-bold tracking-tight text-foreground [overflow-wrap:anywhere]">{ticket.name}</p>
                  {ticket.description && (
                    <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere] line-clamp-2">
                      {ticket.description}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">Máx. {ticket.limitPerBuy} por compra</p>
                </div>

                {/* Preço + Seletor */}
                <div className="flex shrink-0 flex-col items-end gap-2.5">
                  <p className="whitespace-nowrap text-xl font-extrabold tracking-tight text-primary dark:text-[hsl(249_100%_72%)]">
                    {ticket.priceCents === 0 ? "Gratuito" : money(ticket.priceCents)}
                  </p>

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
                        className="h-11 w-11 rounded-xl border-foreground/10 bg-foreground/[0.04] transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary sm:h-9 sm:w-9"
                        disabled={qty <= 0}
                        aria-label={`Remover um ingresso ${ticket.name}`}
                        onClick={() => onQuantityChange(ticket.id, Math.max(0, qty - 1))}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-9 text-center text-base font-bold tabular-nums">
                        {qty}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        data-ticket-add
                        className={`h-11 w-11 rounded-xl transition-all sm:h-9 sm:w-9 ${
                          needsAttention
                            ? "ticket-add-attention border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:text-primary-foreground"
                            : "border-foreground/10 bg-foreground/[0.04] hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
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
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
