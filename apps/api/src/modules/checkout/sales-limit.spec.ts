import { hasReachedSalesEnd } from "./sales-limit";

describe("hasReachedSalesEnd", () => {
  it("permite vendas abaixo do limite", () => {
    expect(hasReachedSalesEnd(9, 10)).toBe(false);
  });

  it("encerra ao atingir ou ultrapassar o limite", () => {
    expect(hasReachedSalesEnd(10, 10)).toBe(true);
    expect(hasReachedSalesEnd(11, 10)).toBe(true);
  });

  it("mantém lotes legados sem limite funcionando", () => {
    expect(hasReachedSalesEnd(999)).toBe(false);
    expect(hasReachedSalesEnd(999, null)).toBe(false);
  });
});
