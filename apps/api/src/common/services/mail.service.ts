import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type MailHealth =
  | { configured: false }
  | { configured: true; reachable: boolean | "unknown"; error?: string };

const MAIL_CHECK_TTL_MS = 60_000;
const MAIL_VERIFY_TIMEOUT_MS = 3_000;

@Injectable()
export class MailService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;
  private static bootWarningLogged = false;
  private static cachedCheck?: { key: string; expiresAt: number; value: MailHealth };
  private static pendingCheck?: { key: string; promise: Promise<MailHealth> };

  constructor(private readonly config: ConfigService) {}

  async onApplicationBootstrap() {
    if (this.config.get<string>("NODE_ENV") !== "production" || MailService.bootWarningLogged) {
      return;
    }

    void this.refreshTransportHealth({ logOnFailure: true }).catch(() => undefined);
  }

  async send(input: MailInput) {
    const host = this.config.get<string>("SMTP_HOST");
    const from = this.config.get<string>("SMTP_FROM");
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASS");

    if (!host || !from || !user || !pass) {
      this.logger.warn(`[Mail Dispatch Skipped] SMTP not configured | Recipient: ${input.to}`);
      return { status: "SKIPPED", recipient: input.to };
    }

    const info = await this.getTransporter().sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html
    });

    return {
      status: "SENT",
      recipient: input.to,
      messageId: info.messageId
    };
  }

  async checkTransport(): Promise<MailHealth> {
    return this.refreshTransportHealth();
  }

  getCachedTransportHealth(): MailHealth {
    const host = this.config.get<string>("SMTP_HOST");
    const from = this.config.get<string>("SMTP_FROM");
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASS");

    if (!host || !from || !user || !pass) {
      return { configured: false };
    }

    const key = this.getHealthCacheKey(host, from);
    const now = Date.now();
    if (MailService.cachedCheck?.key === key && MailService.cachedCheck.expiresAt > now) {
      return MailService.cachedCheck.value;
    }

    return { configured: true, reachable: "unknown" };
  }

  async refreshTransportHealth(options: { logOnFailure?: boolean } = {}): Promise<MailHealth> {
    const host = this.config.get<string>("SMTP_HOST");
    const from = this.config.get<string>("SMTP_FROM");
    const key = this.getHealthCacheKey(host, from);
    const now = Date.now();

    if (MailService.cachedCheck?.key === key && MailService.cachedCheck.expiresAt > now) {
      return MailService.cachedCheck.value;
    }

    if (MailService.pendingCheck?.key === key) {
      return MailService.pendingCheck.promise;
    }

    const promise = this.resolveTransportHealth(host, from).then((value) => {
      MailService.cachedCheck = { key, expiresAt: Date.now() + MAIL_CHECK_TTL_MS, value };
      if (MailService.pendingCheck?.key === key) {
        MailService.pendingCheck = undefined;
      }
      if (
        options.logOnFailure &&
        value.configured &&
        value.reachable === false &&
        !MailService.bootWarningLogged
      ) {
        MailService.bootWarningLogged = true;
        this.logger.error(
          `[Mail Health] SMTP_HOST is configured but unreachable: ${value.error ?? "unknown error"}`
        );
      }
      return value;
    });

    MailService.pendingCheck = { key, promise };
    return promise;
  }

  private async resolveTransportHealth(host?: string, from?: string): Promise<MailHealth> {
    if (
      !host ||
      !from ||
      !this.config.get<string>("SMTP_USER") ||
      !this.config.get<string>("SMTP_PASS")
    ) {
      return { configured: false };
    }

    try {
      await this.verifyWithTimeout();
      return { configured: true, reachable: true };
    } catch (error) {
      return {
        configured: true,
        reachable: false,
        error: this.truncateError(error)
      };
    }
  }

  private getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.getOrThrow<string>("SMTP_HOST"),
        port: this.config.get<number>("SMTP_PORT") ?? 587,
        secure: this.config.get<boolean>("SMTP_SECURE") ?? false,
        connectionTimeout: 5_000,
        greetingTimeout: 5_000,
        socketTimeout: 10_000,
        auth: {
          user: this.config.getOrThrow<string>("SMTP_USER"),
          pass: this.config.getOrThrow<string>("SMTP_PASS")
        }
      });
    }

    return this.transporter;
  }

  private async verifyWithTimeout() {
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.getTransporter().verify(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("verification timed out")),
            MAIL_VERIFY_TIMEOUT_MS
          );
        })
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private getHealthCacheKey(host?: string, from?: string) {
    return [
      host ?? "",
      from ?? "",
      this.config.get<number>("SMTP_PORT") ?? 587,
      this.config.get<boolean>("SMTP_SECURE") ?? false,
      this.config.get<string>("SMTP_USER") ?? ""
    ].join("|");
  }

  private truncateError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return this.redactSmtpSecrets(message).slice(0, 200);
  }

  private redactSmtpSecrets(message: string) {
    return [this.config.get<string>("SMTP_USER"), this.config.get<string>("SMTP_PASS")]
      .filter((value): value is string => Boolean(value))
      .reduce((safeMessage, secret) => safeMessage.split(secret).join("[redacted]"), message);
  }
}
