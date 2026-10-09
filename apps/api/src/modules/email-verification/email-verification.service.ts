import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import { MailService } from "../../common/services/mail.service";
import { PrismaService } from "../../prisma/prisma.service";

export const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 1000 * 60;

type VerifiableUser = { id: string; email: string; name: string };

/**
 * Só caminhos de checkout podem voltar no link de confirmação. Qualquer outra
 * coisa é descartada, para o link do e-mail nunca levar a um endereço externo.
 */
const CHECKOUT_RETURN_PATH = /^\/checkout\/[A-Za-z0-9_-]+(\?[A-Za-z0-9_\-.~%&=:,+]*)?$/;
const CHECKOUT_RETURN_MAX_LENGTH = 500;

export function safeCheckoutReturnPath(value?: string | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const path = value.trim();
  if (!path || path.length > CHECKOUT_RETURN_MAX_LENGTH) return undefined;
  return CHECKOUT_RETURN_PATH.test(path) ? path : undefined;
}

/**
 * Owns the proof that an account controls its e-mail address.
 *
 * Lives outside AuthService because the proof is invalidated from three other
 * places — /users/me, /users/:id and /profile all let the address change, and
 * an address that changed was never proven.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService
  ) {}

  hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  /**
   * Sends a new link. Older links for the same address remain valid until one
   * is used or expires, so a delayed e-mail cannot replace a working link.
   *
   * Never throws — token creation included, not only the SMTP call. Callers
   * invoke this AFTER the account row is already written, so throwing here
   * would answer 500 for a change that did happen and leave the user believing
   * it did not. Losing the link is recoverable: the account is unverified and
   * the person asks for a new one through POST /auth/resend-verification.
   *
   * @returns whether a link was actually issued, for callers that want to log it
   */
  async issue(user: VerifiableUser, options: { next?: string } = {}): Promise<boolean> {
    const email = user.email.toLowerCase();
    const token = randomBytes(32).toString("base64url");

    try {
      await this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          email,
          tokenHash: this.hash(token),
          expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)
        }
      });
    } catch (error) {
      this.logger.error(
        `Falha ao criar o token de verificação do usuário ${user.id}. A conta segue não verificada e pode pedir um novo link.`,
        error as Error
      );
      return false;
    }

    const url = this.verifyEmailUrl(token, safeCheckoutReturnPath(options.next));
    try {
      const delivery = await this.mail.send({
        to: email,
        subject: "Confirme seu e-mail Event Flow",
        text: `Confirme seu e-mail para ativar sua conta Event Flow: ${url}`,
        html: `<p>Olá, ${this.escapeHtml(user.name)}.</p><p>Confirme seu e-mail para ativar sua conta Event Flow.</p><p><a href="${this.escapeHtml(url)}">Confirmar e-mail</a></p><p>Este link expira em 24 horas e só pode ser usado uma vez.</p>`
      });
      if (delivery.status !== "SENT") {
        this.logger.warn(`Verificação de e-mail não enviada para o usuário ${user.id}: ${delivery.status}`);
        await this.invalidateFailedToken(token);
        return false;
      }
    } catch (error) {
      this.logger.error(`Falha ao enviar verificação de e-mail para o usuário ${user.id}`, error as Error);
      await this.invalidateFailedToken(token);
      return false;
    }

    return true;
  }

  private async invalidateFailedToken(token: string) {
    try {
      await this.prisma.emailVerificationToken.updateMany({
        where: { tokenHash: this.hash(token), usedAt: null },
        data: { usedAt: new Date() }
      });
    } catch (error) {
      this.logger.error("Falha ao invalidar link de verificação não enviado", error as Error);
    }
  }

  /**
   * Call after an account's address actually changed.
   *
   * The caller is responsible for writing `emailVerifiedAt: null` in the same
   * statement that writes the new address — see `clearedVerificationData()`.
   * Old-address links cannot verify the new address: AuthService compares the
   * address stored on the token with the current address. Never throws.
   */
  handleEmailChanged(user: VerifiableUser): Promise<boolean> {
    return this.issue(user);
  }

  /**
   * Fields every e-mail change must write alongside the new address.
   * Without this, an account verified under one address keeps the proof after
   * moving to someone else's address and can claim that person's purchases.
   */
  static clearedVerificationData() {
    return { emailVerifiedAt: null };
  }

  /** True when `nextEmail` is a real change from `currentEmail`. */
  static isEmailChange(currentEmail: string, nextEmail?: string | null) {
    if (!nextEmail) return false;
    return nextEmail.trim().toLowerCase() !== currentEmail.toLowerCase();
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private verifyEmailUrl(token: string, next?: string) {
    const appUrl = (this.config.get<string>("APP_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
    const url = new URL("/verificar-email", appUrl);
    url.searchParams.set("token", token);
    // Quem criou a conta na hora de comprar volta para o mesmo checkout.
    if (next) url.searchParams.set("next", next);
    return url.toString();
  }
}
