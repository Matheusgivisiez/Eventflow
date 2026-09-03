export function calculatePercentagePrice(price: number, percent: number): number {
  return Math.round(price * (1 + percent / 100) * 100) / 100;
}

