export function calculatePercentagePrice(price: number, percent: number): number {
  return Math.round(price * (1 + percent / 100) * 100) / 100;
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parseCurrencyInput(value: string): number {
  const normalized = value.replace(/[^\d,.-]/g, "").trim();
  if (!normalized) return 0;
  const hasDecimalSeparator = normalized.includes(",") || normalized.includes(".");
  const numberValue = hasDecimalSeparator
    ? Number(normalized.replace(/\./g, "").replace(",", "."))
    : Number(normalized);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
}
