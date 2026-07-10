"use client";

import Link from "next/link";
import { ShieldCheck, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/utils";

type FloatingBuyBarProps = {
  slug: string;
  totalCents: number;
  totalItems: number;
  selectedItems: Record<string, number>;
};

export function FloatingBuyBar({ slug, totalCents, totalItems, selectedItems }: FloatingBuyBarProps) {
  const itemsParam = Object.entries(selectedItems)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => `${id}:${qty}`)
    .join(",");

  const checkoutUrl = itemsParam
    ? `/checkout/${slug}?items=${encodeURIComponent(itemsParam)}`
    : `/checkout/${slug}`;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 animate-slide-up">
      <div className="glass border-t shadow-[0_-4px_24px_rgb(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 lg:px-8">
          {/* Info de preço */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Ticket className="h-5 w-5 text-primary" />
            </div>
            <div>
              {totalItems > 0 ? (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    {money(totalCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {totalItems} {totalItems === 1 ? "ingresso" : "ingressos"}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Selecione seus ingressos
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Pagamento seguro
                  </p>
                </>
              )}
            </div>
          </div>

          {/* CTA */}
          <Button
            asChild
            size="lg"
            disabled={totalItems === 0}
            className="h-12 px-6 text-base font-bold shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl"
          >
            {totalItems > 0 ? (
              <Link href={checkoutUrl}>
                <Ticket className="mr-2 h-5 w-5" />
                Garantir meu ingresso
              </Link>
            ) : (
              <span>
                <Ticket className="mr-2 h-5 w-5" />
                Garantir meu ingresso
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
