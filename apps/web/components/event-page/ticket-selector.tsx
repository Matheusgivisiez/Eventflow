"use client";

import { Minus, Plus, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/utils";
import type { TicketType } from "@/types/eventflow";

type TicketSelectorProps = {
  ticketTypes: TicketType[];
  quantities: Record<string, number>;
  onQuantityChange: (ticketId: string, quantity: number) => void;
};

export function TicketSelector({ ticketTypes, quantities, onQuantityChange }: TicketSelectorProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Tag className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold tracking-tight">Ingressos</h2>
      </div>

      <div className="space-y-3">
        {ticketTypes.map((ticket, index) => {
          const available = ticket.quantity - ticket.sold;
          const isSoldOut = available <= 0;
          const qty = quantities[ticket.id] ?? 0;

          return (
            <div
              key={ticket.id}
              className={`rounded-2xl border p-5 transition-all duration-200 ${
                isSoldOut
                  ? "bg-muted/30 opacity-60 cursor-not-allowed"
                  : qty > 0
                    ? "border-primary/40 bg-primary/[0.03] shadow-sm"
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
                  {`${index + 1}º Lote`}
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
                      <span>{available} disponíveis</span>
                    )}
                    {!isSoldOut && (
                      <span>Máx. {ticket.limitPerBuy} por compra</span>
                    )}
                  </div>
                </div>

                {/* Preço + Seletor */}
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <p className="text-xl font-bold text-primary">
                    {ticket.priceCents === 0 ? "Gratuito" : money(ticket.priceCents)}
                  </p>

                  {!isSoldOut && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg border-border/60 hover:border-primary/50 hover:text-primary transition-colors"
                        disabled={qty <= 0}
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
                        className="h-8 w-8 rounded-lg border-border/60 hover:border-primary/50 hover:text-primary transition-colors"
                        disabled={qty >= Math.min(available, ticket.limitPerBuy)}
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
