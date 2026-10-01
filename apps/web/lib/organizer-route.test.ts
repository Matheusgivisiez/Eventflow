import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getOrganizerCtaHref } from "./organizer-route";

describe("getOrganizerCtaHref", () => {
  it("envia visitantes ao cadastro de organizador", () => {
    assert.equal(getOrganizerCtaHref(), "/organizador/register");
  });

  it("envia clientes autenticados para conversão da conta", () => {
    assert.equal(getOrganizerCtaHref("CUSTOMER"), "/me/organizador");
  });

  it("envia organizadores autenticados para criação de evento", () => {
    assert.equal(getOrganizerCtaHref("ORGANIZER"), "/events/new");
    assert.equal(getOrganizerCtaHref("ADMIN"), "/events/new");
  });
});
