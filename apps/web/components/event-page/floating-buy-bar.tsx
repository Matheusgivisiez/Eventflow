"use client";

import Link from "next/link";
import { ShieldCheck, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/utils";

type FloatingBuyBarProps = {
  slug: string;
  invite?: string;
  totalCents: number;
  totalItems: number;
  selectedItems: Record<string, number>;
  onEmptySelectionClick?: () => void;
};

export function FloatingBuyBar({
  slug,
  invite,
  totalCents,
  totalItems,
  selectedItems,
  onEmptySelectionClick
}: FloatingBuyBarProps) {
  const itemsParam = Object.entries(selectedItems)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => `${id}:${qty}`)
    .join(",");

  const checkoutParams = new URLSearchParams();
  if (itemsParam) checkoutParams.set("items", itemsParam);
  if (invite) checkoutParams.set("invite", invite);
  const checkoutUrl = `/checkout/${slug}${checkoutParams.size ? `?${checkoutParams}` : ""}`;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 animate-slide-up">
      <div className="glass rounded-t-3xl border-t border-foreground/10 shadow-[0_-12px_32px_-12px_rgb(0,0,0,0.35)] sm:rounded-none">
        <div className="mx-auto flex w-full min-w-0 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5 lg:px-8">
          {/* Info de preço */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Ticket className="h-5 w-5 text-primary" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              {totalItems > 0 ? (
                <>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {money(totalCents)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {totalItems} {totalItems === 1 ? "ingresso" : "ingressos"}
                  </p>
                </>
              ) : (
                <>
                  <p className="truncate text-sm font-medium text-foreground">
                    Selecione seus ingressos
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <ShieldCheck className="h-3 w-3 shrink-0" />
                    <span className="truncate">Pagamento seguro</span>
                  </p>
                </>
              )}
            </div>
          </div>

          {/* CTA */}
          <Button
            asChild
            size="lg"
            onClick={totalItems === 0 ? onEmptySelectionClick : undefined}
            className="h-12 shrink-0 rounded-2xl px-5 text-base font-bold shadow-[0_10px_30px_-6px_hsl(var(--primary)/0.6)] transition-all hover:scale-[1.02] active:scale-95 sm:px-6"
          >
            {totalItems > 0 ? (
              <Link href={checkoutUrl}>
                <Ticket className="mr-2 h-5 w-5" />
                <span className="sm:hidden">Garantir</span>
                <span className="hidden sm:inline">Garantir meu ingresso</span>
              </Link>
            ) : (
              <button type="button" aria-label="Selecionar ingressos para continuar">
                <Ticket className="mr-2 h-5 w-5" />
                <span className="sm:hidden">Garantir</span>
                <span className="hidden sm:inline">Garantir meu ingresso</span>
              </button>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
