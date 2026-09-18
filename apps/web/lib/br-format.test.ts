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

  it("aceita numero sem DDI e apenas acrescenta o +55 na exibicao", () => {
    assert.equal(normalizeBrazilPhone("(33) 99854-2884"), "33998542884");
    assert.equal(formatBrazilPhone("(33) 99854-2884"), "+55 (33) 99854-2884");
  });

  it("apagar um digito encurta o numero em vez de inventar outro", () => {
    // Regressao: apagar o ultimo digito deixava 10 digitos, um "9" era
    // recolocado no lugar e o campo nunca esvaziava.
    assert.equal(formatBrazilPhone("+55 (33) 99854-288"), "+55 (33) 99854-288");
    assert.equal(formatBrazilPhone("+55 (33) 99854-28"), "+55 (33) 99854-28");
    assert.equal(formatBrazilPhone("+55 (33) 9985"), "+55 (33) 9985");
    assert.equal(formatBrazilPhone("+55 (3"), "+55 (3");
  });

  it("apagar digito por digito sempre reduz o tamanho ate esvaziar", () => {
    let campo = formatBrazilPhone("33998542884");
    const tamanhos = [campo.length];
    for (let i = 0; i < 25 && campo.length > 0; i += 1) {
      campo = formatBrazilPhone(campo.slice(0, -1));
      assert.ok(campo.length < tamanhos[tamanhos.length - 1], `campo nao encurtou: "${campo}"`);
      tamanhos.push(campo.length);
    }
    assert.equal(campo, "");
  });

  it("nao deixa passar numero incompleto na validacao do formulario", () => {
    assert.notEqual(normalizeBrazilPhone("(33) 9854-2884").length, 11);
  });
});
