import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculatePercentagePrice, formatBRL, parseCurrencyInput } from "./ticket-pricing";

describe("calculatePercentagePrice", () => {
  it("calcula o percentual sobre o lote anterior", () => {
    assert.equal(calculatePercentagePrice(100, 10), 110);
    assert.equal(calculatePercentagePrice(79.9, 10), 87.89);
  });

  it("formata e interpreta preço em reais", () => {
    assert.equal(formatBRL(200), "R$ 200,00");
    assert.equal(parseCurrencyInput("200,50"), 200.5);
    assert.equal(parseCurrencyInput("R$ 1.250,90"), 1250.9);
    assert.equal(parseCurrencyInput("200"), 200);
  });
});
