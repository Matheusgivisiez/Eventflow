import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGuestList, validateGuests } from "./courtesy-guests";

describe("parseGuestList", () => {
  it("lê nome e e-mail separados por vírgula, ponto e vírgula ou tabulação", () => {
    const { guests, errors } = parseGuestList("Ana Souza, ANA@Example.com\nLeo Lima; leo@example.com; 2\nBia Reis\tbia@example.com\t3");
    assert.deepEqual(errors, []);
    assert.deepEqual(guests, [
      { name: "Ana Souza", email: "ana@example.com", quantity: 1 },
      { name: "Leo Lima", email: "leo@example.com", quantity: 2 },
      { name: "Bia Reis", email: "bia@example.com", quantity: 3 }
    ]);
  });

  it("aceita a ordem invertida e ignora linhas vazias", () => {
    const { guests } = parseGuestList("\n  ana@example.com, Ana Souza  \n\n");
    assert.deepEqual(guests, [{ name: "Ana Souza", email: "ana@example.com", quantity: 1 }]);
  });

  it("aponta a linha com problema em vez de emitir pela metade", () => {
    const { guests, errors } = parseGuestList("Ana, ana@example.com\nSem Email\n, leo@example.com\nBia, bia@example.com, 99");
    assert.equal(guests.length, 1);
    assert.deepEqual(errors, [
      "Linha 2: e-mail não encontrado ou inválido.",
      "Linha 3: informe o nome do convidado.",
      "Linha 4: a quantidade deve ficar entre 1 e 10."
    ]);
  });

  it("recusa mais convidados do que a API aceita por vez", () => {
    const text = Array.from({ length: 31 }, (_, i) => `Convidado ${String.fromCharCode(65 + (i % 26))}x, c${i}@example.com`).join("\n");
    const { errors } = parseGuestList(text);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /no máximo 30/);
  });
});

describe("validateGuests", () => {
  it("exige pelo menos um convidado preenchido", () => {
    assert.equal(validateGuests([{ name: "", email: "", quantity: 1 }]), "Adicione pelo menos um convidado.");
  });

  it("aponta nome, e-mail e quantidade inválidos", () => {
    assert.equal(validateGuests([{ name: "A", email: "a@example.com", quantity: 1 }]), "Convidado 1: informe o nome.");
    assert.equal(validateGuests([{ name: "Ana", email: "ana@", quantity: 1 }]), "Convidado 1: e-mail inválido.");
    assert.equal(validateGuests([{ name: "Ana", email: "ana@example.com", quantity: 0 }]), "Convidado 1: a quantidade deve ficar entre 1 e 10.");
  });

  it("aprova uma lista correta e ignora linhas em branco do formulário", () => {
    assert.equal(validateGuests([{ name: "Ana", email: "ana@example.com", quantity: 2 }, { name: "", email: "", quantity: 1 }]), null);
  });
});
