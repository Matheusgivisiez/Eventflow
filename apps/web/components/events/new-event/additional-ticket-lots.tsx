"use client";

import { Plus } from "lucide-react";
import { TicketLotEditor, type TicketLotValues } from "@/components/events/new-event/ticket-lot-editor";
import { Button } from "@/components/ui/button";
import { calculatePercentagePrice } from "@/lib/ticket-pricing";

export function AdditionalTicketLots({ lots, basePrice, onChange }: { lots: TicketLotValues[]; basePrice: number; onChange: (lots: TicketLotValues[]) => void }) {
  function updateLot(index: number, field: keyof TicketLotValues, value: string | number) {
    onChange(lots.map((lot, lotIndex) => lotIndex === index ? { ...lot, [field]: value } : lot));
  }

  function previousPriceFor(index: number) {
    let price = basePrice;
    for (let lotIndex = 0; lotIndex < index; lotIndex += 1) {
      const lot = lots[lotIndex];
      price = lot?.priceMode === "PERCENTAGE" && lot.priceAdjustmentPercent !== undefined
        ? calculatePercentagePrice(price, lot.priceAdjustmentPercent)
        : lot?.price ?? price;
    }
    return price;
  }

  return (
    <div className="space-y-4">
      {lots.map((lot, index) => (
        <TicketLotEditor
          key={`additional-lot-${index}`}
          title={`Configure o lote ${index + 2}`}
          values={lot}
          errors={{}}
          previousPrice={previousPriceFor(index)}
          onChange={(field, value) => updateLot(index, field, value)}
          onRemove={() => onChange(lots.filter((_, lotIndex) => lotIndex !== index))}
        />
      ))}
      <Button type="button" variant="outline" className="w-full gap-2" onClick={() => onChange([...lots, { name: `Lote ${lots.length + 2}`, price: 0, quantity: 100, limitPerBuy: 5, priceMode: "FIXED" }])}>
        <Plus className="h-4 w-4" /> Adicionar outro lote
      </Button>
    </div>
  );
}
