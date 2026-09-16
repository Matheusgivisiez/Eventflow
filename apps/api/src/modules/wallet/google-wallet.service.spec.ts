import { createVerify, generateKeyPairSync } from "crypto";
import { GoogleWalletService, signRs256Jwt } from "./google-wallet.service";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const ticket = {
  uuid: "5f402f49-aaaa-bbbb-cccc-1234567890ab",
  orderId: "order_1",
  signature: "sig",
  attendeeName: "Riquelmy Vasconcelos",
  ticketTypeName: "Pista — 1º Lote",
  event: {
    id: "evt_1",
    title: "Noite Violeta",
    slug: "noite-violeta",
    startsAt: new Date("2026-11-21T19:00:00.000Z"),
    endsAt: null,
    format: "IN_PERSON",
    address: "Av. Roberto Burle Marx, s/n",
    city: "Ipatinga",
    state: "MG",
    bannerUrl: "https://cdn.example.com/banner.jpg",
  },
};

function makeService(env: Record<string, string | undefined>) {
  const config = { get: jest.fn((key: string) => env[key]) };
  return new GoogleWalletService(config as any);
}

function decode(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

describe("GoogleWalletService", () => {
  const env = {
    APP_URL: "https://eventflowtickets.com.br/",
    GOOGLE_WALLET_ISSUER_ID: "3388000000012345678",
    GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: JSON.stringify({
      client_email: "wallet@eventflow.iam.gserviceaccount.com",
      private_key: privateKey,
    }),
  };

  afterEach(() => jest.restoreAllMocks());

  it("is disabled without credentials", () => {
    expect(makeService({}).isEnabled()).toBe(false);
    expect(makeService({ GOOGLE_WALLET_ISSUER_ID: "1" }).isEnabled()).toBe(false);
  });

  it("accepts the service account as base64", () => {
    const service = makeService({
      ...env,
      GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: Buffer.from(env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON).toString("base64"),
    });
    expect(service.isEnabled()).toBe(true);
  });

  it("signs verifiable RS256 JWTs", () => {
    const jwt = signRs256Jwt({ hello: "world" }, privateKey);
    const [header, body, signature] = jwt.split(".");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${body}`);
    expect(verifier.verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true);
    expect(decode(body)).toEqual({ hello: "world" });
  });

  it("puts the same QR payload validated at the gate into the pass", () => {
    const object = makeService(env).buildObject(ticket);
    expect(object.id).toBe("3388000000012345678.ticket_5f402f49-aaaa-bbbb-cccc-1234567890ab");
    expect(object.classId).toBe("3388000000012345678.event_evt_1");
    expect(JSON.parse(object.barcode.value)).toEqual({ uuid: ticket.uuid, orderId: "order_1", signature: "sig" });
    expect(object.ticketNumber).toBe("5F402F49");
  });

  it("builds the event class with venue, date and public images", () => {
    const eventClass = makeService(env).buildClass(ticket);
    expect(eventClass.eventName.defaultValue.value).toBe("Noite Violeta");
    expect(eventClass.dateTime.start).toBe("2026-11-21T19:00:00.000Z");
    expect(eventClass.heroImage?.sourceUri.uri).toBe("https://cdn.example.com/banner.jpg");
    expect(eventClass.logo?.sourceUri.uri).toBe("https://eventflowtickets.com.br/icons/icon-512x512.png");
    expect(eventClass.homepageUri?.uri).toBe("https://eventflowtickets.com.br/eventos/noite-violeta");
  });

  it("creates class and object, then returns a save link referencing the object", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("oauth2")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    const { saveUrl } = await makeService(env).createSaveUrl(ticket);

    expect(saveUrl.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);
    const claims = decode(saveUrl.split("/").pop()!.split(".")[1]);
    expect(claims).toMatchObject({
      aud: "google",
      typ: "savetowallet",
      origins: ["https://eventflowtickets.com.br"],
      payload: { eventTicketObjects: [{ id: "3388000000012345678.ticket_5f402f49-aaaa-bbbb-cccc-1234567890ab" }] },
    });
    const calls = fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${String(url).split("/v1").pop()}`);
    expect(calls).toEqual(["POST https://oauth2.googleapis.com/token", "POST /eventTicketClass", "POST /eventTicketObject"]);
  });

  it("patches when class or object already exists", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      if (String(url).includes("oauth2")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      }
      return new Response("{}", { status: init?.method === "POST" ? 409 : 200 });
    });

    await makeService(env).createSaveUrl(ticket);
    const methods = fetchMock.mock.calls.slice(1).map(([, init]) => init?.method);
    expect(methods).toEqual(["POST", "PATCH", "POST", "PATCH"]);
  });

  it("fails with a friendly error when Google rejects the object", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("oauth2")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      }
      return new Response("bad", { status: 400 });
    });

    await expect(makeService(env).createSaveUrl(ticket)).rejects.toThrow("Google Wallet");
  });

  it("never throws when deactivating a pass", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    await expect(makeService(env).deactivateTicket(ticket.uuid)).resolves.toBeUndefined();
  });
});
