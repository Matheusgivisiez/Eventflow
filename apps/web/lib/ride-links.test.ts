import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGoogleMapsLink,
  buildMapEmbedSrc,
  buildUberLink,
  buildWazeLink,
  getFullAddress,
} from "./ride-links";

const baseEvent = {
  address: "Rua das Flores, 123",
  city: "Coronel Fabriciano",
  state: "MG",
  zipCode: "35170-000",
};

describe("getFullAddress", () => {
  it("monta o endereco completo com cidade, estado e cep", () => {
    assert.equal(
      getFullAddress(baseEvent),
      "Rua das Flores, 123, Coronel Fabriciano - MG, CEP 35170-000"
    );
  });

  it("ignora campos ausentes", () => {
    assert.equal(getFullAddress({ address: "Rua X" }), "Rua X");
  });
});

describe("buildMapEmbedSrc", () => {
  it("usa coordenadas quando o mapUrl do organizador ja tem @lat,lng", () => {
    const event = { ...baseEvent, mapUrl: "https://www.google.com/maps/@-19.5197,-42.6267,17z" };
    assert.equal(
      buildMapEmbedSrc(event),
      "https://www.google.com/maps?q=-19.5197,-42.6267&z=16&output=embed"
    );
  });

  it("usa coordenadas quando o mapUrl tem ?q=lat,lng", () => {
    const event = { ...baseEvent, mapUrl: "https://maps.google.com/?q=-19.5197,-42.6267" };
    assert.equal(
      buildMapEmbedSrc(event),
      "https://www.google.com/maps?q=-19.5197,-42.6267&z=16&output=embed"
    );
  });

  it("cai para o endereco textual quando nao ha coordenadas", () => {
    assert.equal(
      buildMapEmbedSrc(baseEvent),
      `https://www.google.com/maps?q=${encodeURIComponent(getFullAddress(baseEvent))}&output=embed`
    );
  });
});

describe("buildGoogleMapsLink", () => {
  it("gera link de busca com o endereco quando nao ha mapUrl", () => {
    assert.equal(
      buildGoogleMapsLink(baseEvent),
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getFullAddress(baseEvent))}`
    );
  });
});

describe("buildUberLink", () => {
  const originalClientId = process.env.NEXT_PUBLIC_UBER_CLIENT_ID;

  it("inclui client_id quando NEXT_PUBLIC_UBER_CLIENT_ID esta configurado", () => {
    process.env.NEXT_PUBLIC_UBER_CLIENT_ID = "abc123";
    const link = buildUberLink(baseEvent);
    assert.match(link, /[?&]client_id=abc123/);
    process.env.NEXT_PUBLIC_UBER_CLIENT_ID = originalClientId;
  });

  it("nao quebra quando NEXT_PUBLIC_UBER_CLIENT_ID nao esta configurado", () => {
    delete process.env.NEXT_PUBLIC_UBER_CLIENT_ID;
    const link = buildUberLink(baseEvent);
    assert.doesNotMatch(link, /client_id/);
    process.env.NEXT_PUBLIC_UBER_CLIENT_ID = originalClientId;
  });

  it("inclui pickup=my_location e o endereco de destino, com colchetes literais na chave", () => {
    const link = buildUberLink(baseEvent, "Festa Junina");
    assert.match(link, /^https:\/\/m\.uber\.com\/ul\/\?/);
    assert.match(link, /action=setPickup/);
    assert.match(link, /pickup=my_location/);
    // As chaves dropoff[...] tem que ficar literais (nao %5B%5D) -- e assim que
    // o exemplo oficial da Uber documenta, e colchetes codificados fazem o
    // destino chegar em branco no app.
    assert.match(link, /dropoff\[formatted_address\]=/);
    assert.match(link, /dropoff\[nickname\]=Festa%20Junina/);
    assert.doesNotMatch(link, /%5B|%5D/);
  });

  it("inclui lat/lng do dropoff quando o mapUrl tem coordenadas", () => {
    const event = { ...baseEvent, mapUrl: "https://www.google.com/maps/@-19.5197,-42.6267,17z" };
    const link = buildUberLink(event);
    assert.match(link, /dropoff\[latitude\]=-19\.5197/);
    assert.match(link, /dropoff\[longitude\]=-42\.6267/);
  });
});

describe("buildWazeLink", () => {
  it("inclui navigate=yes e o endereco", () => {
    const link = buildWazeLink(baseEvent);
    assert.match(link, /^https:\/\/waze\.com\/ul\?/);
    assert.match(link, /navigate=yes/);
    assert.match(link, /q=/);
  });

  it("inclui ll quando ha coordenadas", () => {
    const event = { ...baseEvent, mapUrl: "https://www.google.com/maps/@-19.5197,-42.6267,17z" };
    const link = buildWazeLink(event);
    assert.match(link, /ll=-19\.5197%2C-42\.6267/);
  });
});
