import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/lib/utils";
import type { EventHubEvent, TicketType } from "@/types/eventhub";

export function TicketSelector({ event }: { event: EventHubEvent }) {
  return (
    <Card className="sticky top-24 overflow-hidden border-border/50 shadow-xl shadow-black/5">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4 border-b">
        <h2 className="text-lg font-semibold tracking-tight">Ingressos</h2>
        <p className="text-sm text-muted-foreground">Escolha o melhor setor para voce.</p>
      </div>
      <CardContent className="space-y-5 p-6">
        {event.ticketTypes.map((ticket) => {
          const available = ticket.quantity - ticket.sold;
          const isSoldOut = available <= 0;
          
          return (
            <div 
              key={ticket.id} 
              className={`relative rounded-xl border p-4 transition-colors ${isSoldOut ? "bg-muted/50 opacity-60" : "hover:border-primary/50 hover:bg-muted/30"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">{ticket.name}</p>
                  {ticket.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{ticket.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">{money(ticket.priceCents)}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className={isSoldOut ? "text-destructive font-medium" : "text-muted-foreground"}>
                  {isSoldOut ? "Esgotado" : `${available} ingressos disponiveis`}
                </span>
                {!isSoldOut && (
                  <span className="font-medium text-foreground">
                    Ate {ticket.limitPerBuy} por compra
                  </span>
                )}
              </div>
            </div>
          );
        })}
        
        <div className="pt-2">
          <Button asChild className="w-full h-12 text-base font-semibold shadow-md transition-transform hover:scale-[1.02]">
            <Link href={`/checkout/${event.slug}`}>
              Comprar Ingressos
            </Link>
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Pagamento seguro processado por EventHub.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
