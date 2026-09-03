import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCep } from "./cep";

describe("formatCep", () => {
  it("aplica a máscara brasileira e limita a oito dígitos", () => {
    assert.equal(formatCep("01311000"), "01311-000");
    assert.equal(formatCep("01311-000abc"), "01311-000");
  });

  it("remove caracteres não numéricos incompletos", () => {
    assert.equal(formatCep("abc"), "");
    assert.equal(formatCep("123"), "123");
  });
});

