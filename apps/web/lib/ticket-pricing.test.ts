import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculatePercentagePrice } from "./ticket-pricing";

describe("calculatePercentagePrice", () => {
  it("calcula o percentual sobre o lote anterior", () => {
    assert.equal(calculatePercentagePrice(100, 10), 110);
    assert.equal(calculatePercentagePrice(79.9, 10), 87.89);
  });
});

