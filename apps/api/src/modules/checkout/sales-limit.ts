export function hasReachedSalesEnd(sold: number, salesEndQuantity?: number | null): boolean {
  return salesEndQuantity != null && sold >= salesEndQuantity;
}

