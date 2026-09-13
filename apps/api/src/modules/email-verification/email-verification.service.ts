import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import { MailService } from "../../common/services/mail.service";
import { PrismaService } from "../../prisma/prisma.service";

export const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 30;
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 1000 * 60;

type VerifiableUser = { id: string; email: string; name: string };

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
   * Invalidates every outstanding link and sends a new one.
   * Never throws: a mail outage must not break sign-up or a profile update.
   */
  async issue(user: VerifiableUser) {
    const email = user.email.toLowerCase();
    const token = randomBytes(32).toString("base64url");

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() }
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          email,
          tokenHash: this.hash(token),
          expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)
        }
      })
    ]);

    const url = this.verifyEmailUrl(token);
    try {
      await this.mail.send({
        to: email,
        subject: "Confirme seu e-mail Event Flow",
        text: `Confirme seu e-mail para reunir seus ingressos: ${url}`,
        html: `<p>Ola, ${this.escapeHtml(user.name)}.</p><p>Confirme seu e-mail para reunir suas compras em Meus Ingressos.</p><p><a href="${url}">Confirmar e-mail</a></p><p>Este link expira em 30 minutos e so pode ser usado uma vez.</p>`
      });
    } catch (error) {
      this.logger.error(`Falha ao enviar verificacao de e-mail para o usuario ${user.id}`, error as Error);
    }
  }

  /**
   * Call after an account's address actually changed.
   *
   * The caller is responsible for writing `emailVerifiedAt: null` in the same
   * statement that writes the new address — see `clearedVerificationData()`.
   * This only burns the old links and sends a link to the new address.
   */
  async handleEmailChanged(user: VerifiableUser) {
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });
    await this.issue(user);
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

  private verifyEmailUrl(token: string) {
    const appUrl = (this.config.get<string>("APP_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
    const url = new URL("/verificar-email", appUrl);
    url.searchParams.set("token", token);
    return url.toString();
  }
}
