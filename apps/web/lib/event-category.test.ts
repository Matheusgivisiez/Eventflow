import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OTHER_CATEGORY, resolveEventCategory } from "./event-category";

describe("event category", () => {
  it("preserva categorias pré-definidas", () => {
    assert.equal(resolveEventCategory("Teatro"), "Teatro");
  });

  it("usa e limpa a categoria personalizada em Outro", () => {
    assert.equal(resolveEventCategory(OTHER_CATEGORY, "  Feira gastronômica  "), "Feira gastronômica");
    assert.equal(resolveEventCategory(OTHER_CATEGORY, "   "), "");
  });
});

