import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createSign } from "crypto";

/**
 * Google Wallet — ingresso de evento (EventTicketClass + EventTicketObject).
 *
 * Fluxo:
 *  1. Autentica com a service account (JWT RS256 -> access token OAuth).
 *  2. Garante a classe do evento e o objeto do ingresso via REST (insert ou patch).
 *  3. Devolve um link "Salvar no Google Wallet" com um JWT curto que só
 *     referencia o objeto já criado.
 *
 * O id do objeto usa o uuid do ingresso. Como a transferência gera um uuid
 * novo, o passe antigo nunca é reaproveitado: ele é marcado INACTIVE.
 */

type ServiceAccount = { client_email: string; private_key: string };

export type WalletTicketInput = {
  uuid: string;
  orderId: string;
  signature: string;
  attendeeName: string;
  ticketTypeName: string;
  event: {
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date | null;
    format: string;
    address: string | null;
    city: string | null;
    state: string | null;
    bannerUrl: string | null;
    slug: string;
  };
};

const API_BASE = "https://walletobjects.googleapis.com/walletobjects/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const LANGUAGE = "pt-BR";

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signRs256Jwt(payload: Record<string, unknown>, privateKey: string) {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${body}`);
  return `${header}.${body}.${base64url(signer.sign(privateKey))}`;
}

/** Ids do Wallet aceitam apenas letras, números, ".", "_" e "-". */
function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function localized(value: string) {
  return { defaultValue: { language: LANGUAGE, value } };
}

function isPublicHttpsUrl(value: string | null | undefined): value is string {
  return Boolean(value && /^https:\/\//i.test(value));
}

@Injectable()
export class GoogleWalletService {
  private readonly logger = new Logger(GoogleWalletService.name);
  private cachedToken: { value: string; expiresAt: number } | null = null;
  private account: ServiceAccount | null | undefined;

  constructor(private readonly config: ConfigService) {}

  isEnabled() {
    return Boolean(this.issuerId() && this.serviceAccount());
  }

  classId(eventId: string) {
    return `${this.issuerId()}.event_${safeId(eventId)}`;
  }

  objectId(ticketUuid: string) {
    return `${this.issuerId()}.ticket_${safeId(ticketUuid)}`;
  }

  buildClass(ticket: WalletTicketInput) {
    const { event } = ticket;
    const appUrl = this.appUrl();
    const logoUrl = this.config.get<string>("GOOGLE_WALLET_LOGO_URL") || `${appUrl}/icons/icon-512x512.png`;
    const region = [event.city, event.state].filter(Boolean).join(", ");

    return {
      id: this.classId(event.id),
      issuerName: this.config.get<string>("GOOGLE_WALLET_ISSUER_NAME") || "Eventflow",
      reviewStatus: "UNDER_REVIEW",
      eventName: localized(event.title),
      hexBackgroundColor: "#14121f",
      ...(isPublicHttpsUrl(logoUrl) ? { logo: { sourceUri: { uri: logoUrl } } } : {}),
      ...(isPublicHttpsUrl(event.bannerUrl)
        ? { heroImage: { sourceUri: { uri: event.bannerUrl } } }
        : {}),
      ...(event.format === "ONLINE"
        ? { venue: { name: localized("Online"), address: localized("Evento online") } }
        : event.address || region
          ? {
              venue: {
                name: localized(event.address || region),
                address: localized(region || event.address || ""),
              },
            }
          : {}),
      dateTime: {
        start: event.startsAt.toISOString(),
        ...(event.endsAt ? { end: event.endsAt.toISOString() } : {}),
      },
      ...(isPublicHttpsUrl(appUrl)
        ? { homepageUri: { uri: `${appUrl}/eventos/${event.slug}`, description: "Ver evento" } }
        : {}),
    };
  }

  buildObject(ticket: WalletTicketInput) {
    return {
      id: this.objectId(ticket.uuid),
      classId: this.classId(ticket.event.id),
      state: "ACTIVE",
      ticketHolderName: ticket.attendeeName,
      ticketNumber: ticket.uuid.slice(0, 8).toUpperCase(),
      ticketType: localized(ticket.ticketTypeName),
      barcode: {
        type: "QR_CODE",
        // Mesmo conteúdo do QR exibido no site: a portaria valida igual.
        value: JSON.stringify({
          uuid: ticket.uuid,
          orderId: ticket.orderId,
          signature: ticket.signature,
        }),
        alternateText: ticket.uuid.slice(0, 8).toUpperCase(),
      },
    };
  }

  /** Cria/atualiza classe e objeto e devolve o link de salvar. */
  async createSaveUrl(ticket: WalletTicketInput) {
    const account = this.requireAccount();

    await this.upsert("eventTicketClass", this.buildClass(ticket));
    const object = this.buildObject(ticket);
    await this.upsert("eventTicketObject", object);

    const origin = this.appUrl();
    const jwt = signRs256Jwt(
      {
        iss: account.client_email,
        aud: "google",
        typ: "savetowallet",
        iat: Math.floor(Date.now() / 1000),
        origins: origin ? [origin] : [],
        payload: { eventTicketObjects: [{ id: object.id }] },
      },
      account.private_key,
    );

    return { saveUrl: `https://pay.google.com/gp/v/save/${jwt}` };
  }

  /**
   * Desativa o passe de um uuid (transferência, reembolso, cancelamento).
   * Nunca lança erro: falha no Google não pode quebrar o fluxo principal,
   * e a portaria já recusa o QR antigo de qualquer forma.
   */
  async deactivateTicket(ticketUuid: string) {
    if (!this.isEnabled()) return;
    try {
      const response = await this.request(
        "PATCH",
        `/eventTicketObject/${encodeURIComponent(this.objectId(ticketUuid))}`,
        { state: "INACTIVE" },
      );
      // 404 = o comprador nunca adicionou este ingresso à carteira.
      if (!response.ok && response.status !== 404) {
        this.logger.warn(`Falha ao desativar passe ${ticketUuid}: HTTP ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(`Falha ao desativar passe ${ticketUuid}: ${(error as Error).message}`);
    }
  }

  private async upsert(resource: "eventTicketClass" | "eventTicketObject", body: { id: string }) {
    const inserted = await this.request("POST", `/${resource}`, body);
    if (inserted.ok) return;

    if (inserted.status === 409) {
      const patched = await this.request(
        "PATCH",
        `/${resource}/${encodeURIComponent(body.id)}`,
        body,
      );
      if (patched.ok) return;
      await this.fail(resource, patched);
    }

    await this.fail(resource, inserted);
  }

  private async fail(resource: string, response: Response): Promise<never> {
    const detail = await response.text().catch(() => "");
    this.logger.error(`Google Wallet ${resource} HTTP ${response.status}: ${detail.slice(0, 500)}`);
    throw new ServiceUnavailableException(
      "Não foi possível gerar o passe do Google Wallet agora. Tente novamente em instantes.",
    );
  }

  private async request(method: string, path: string, body?: unknown) {
    const token = await this.accessToken();
    return fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  }

  private async accessToken() {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.value;
    }

    const account = this.requireAccount();
    const now = Math.floor(Date.now() / 1000);
    const assertion = signRs256Jwt(
      { iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
      account.private_key,
    );

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      await this.fail("oauth token", response);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  private requireAccount() {
    const account = this.serviceAccount();
    if (!this.issuerId() || !account) {
      throw new ServiceUnavailableException("Google Wallet ainda não está disponível.");
    }
    return account;
  }

  private issuerId() {
    return this.config.get<string>("GOOGLE_WALLET_ISSUER_ID")?.trim() || null;
  }

  private appUrl() {
    return (this.config.get<string>("APP_URL") ?? "").replace(/\/+$/, "");
  }

  /** Aceita o JSON da service account cru ou em base64 (mais fácil de colar no Render). */
  private serviceAccount(): ServiceAccount | null {
    if (this.account !== undefined) return this.account;

    const raw = this.config.get<string>("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON")?.trim();
    if (!raw) return (this.account = null);

    try {
      const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
      const parsed = JSON.parse(text) as Partial<ServiceAccount>;
      if (!parsed.client_email || !parsed.private_key) throw new Error("campos ausentes");
      this.account = {
        client_email: parsed.client_email,
        private_key: parsed.private_key.replace(/\\n/g, "\n"),
      };
    } catch (error) {
      this.logger.error(`GOOGLE_WALLET_SERVICE_ACCOUNT_JSON inválido: ${(error as Error).message}`);
      this.account = null;
    }
    return this.account;
  }
}
