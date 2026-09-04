import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMobileAccountNavItems } from "./mobile-account-navigation";

describe("getMobileAccountNavItems", () => {
  it("oferece ativacao de produtor para cliente autenticado", () => {
    const items = getMobileAccountNavItems("CUSTOMER", "/me/organizador");

    assert.deepEqual(items.map((item) => item.label), ["Explorar", "Perfil", "Ser produtor"]);
    assert.equal(items.some((item) => item.label === "Painel"), false);
    assert.deepEqual(items.find((item) => item.id === "become-producer"), {
      id: "become-producer",
      href: "/me/organizador",
      label: "Ser produtor",
      ariaLabel: "Ativar conta de produtor",
      isActive: true
    });
  });

  it("exibe o painel para produtor e o mantém ativo em toda a area operacional", () => {
    const dashboardItems = getMobileAccountNavItems("ORGANIZER", "/dashboard");
    const eventItems = getMobileAccountNavItems("ORGANIZER", "/events/new");

    assert.deepEqual(dashboardItems.map((item) => item.label), ["Explorar", "Perfil", "Painel"]);
    assert.equal(dashboardItems.find((item) => item.id === "panel")?.isActive, true);
    assert.equal(eventItems.find((item) => item.id === "panel")?.isActive, true);
  });

  it("marca Perfil nas telas do cliente, exceto na ativacao de produtor", () => {
    const ticketsItems = getMobileAccountNavItems("ORGANIZER", "/me/ingressos");
    const activationItems = getMobileAccountNavItems("CUSTOMER", "/me/organizador");

    assert.equal(ticketsItems.find((item) => item.id === "profile")?.isActive, true);
    assert.equal(activationItems.find((item) => item.id === "profile")?.isActive, false);
  });
});
