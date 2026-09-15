import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatBrazilPhone, formatCpf, normalizeBrazilPhone } from "./br-format";

describe("formatCpf", () => {
  it("formata CPF com pontos e traco", () => {
    assert.equal(formatCpf("12345678901"), "123.456.789-01");
  });
});

describe("formatBrazilPhone", () => {
  it("aceita DDI +55 e exibe DDD com celular", () => {
    assert.equal(formatBrazilPhone("+55 33 99854-2884"), "+55 (33) 99854-2884");
  });

  it("mantem a digitacao parcial depois do +55 como DDD nacional", () => {
    assert.equal(formatBrazilPhone("+55 33"), "+55 (33");
  });

  it("acrescenta o nono digito quando o celular vem com oito digitos", () => {
    assert.equal(normalizeBrazilPhone("(33) 9854-2884"), "33998542884");
    assert.equal(formatBrazilPhone("(33) 9854-2884"), "+55 (33) 99854-2884");
  });
});
