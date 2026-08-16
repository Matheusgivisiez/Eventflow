import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Transporter } from "nodemailer";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  async send(input: MailInput) {
    const host = this.config.get<string>("SMTP_HOST");
    const from = this.config.get<string>("SMTP_FROM");

    if (!host || !from) {
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

  private getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.getOrThrow<string>("SMTP_HOST"),
        port: this.config.get<number>("SMTP_PORT") ?? 587,
        secure: this.config.get<boolean>("SMTP_SECURE") ?? false,
        auth: {
          user: this.config.getOrThrow<string>("SMTP_USER"),
          pass: this.config.getOrThrow<string>("SMTP_PASS")
        }
      });
    }

    return this.transporter;
  }
}
