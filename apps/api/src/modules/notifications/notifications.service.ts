import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationEvent, NotificationStatus, NotificationType, Prisma } from "@prisma/client";
import { MailService } from "../../common/services/mail.service";
import { PrismaService } from "../../prisma/prisma.service";
import { renderPurchaseConfirmed } from "./templates/purchase-confirmed.template";

type MailBody = { subject: string; text: string; html: string };

type NotifyInput = {
  userId?: string;
  type: NotificationType;
  event: NotificationEvent;
  recipient: string;
  payload: Prisma.InputJsonValue;
  /** Same key twice never produces a second message. */
  dedupeKey?: string;
  /** Present only for channels we can actually deliver today (EMAIL). */
  mail?: MailBody;
};

export type PurchaseApprovedInput = {
  userId?: string;
  email: string;
  phone?: string;
  orderId: string;
  orderAccessToken?: string | null;
  buyerName: string;
  eventTitle: string;
  eventStartsAt: Date;
  ticketCount: number;
};

const PRISMA_UNIQUE_VIOLATION = "P2002";
const MAX_DELIVERY_ATTEMPTS = 5;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService
  ) {}

  async send(input: NotifyInput) {
    const existing = input.dedupeKey
      ? await this.prisma.notificationLog.findUnique({ where: { dedupeKey: input.dedupeKey } })
      : null;

    if (existing) {
      // A previous attempt failed to reach the SMTP server. Whoever touches
      // this order again — a replayed webhook, a reconciliation, an
      // administrative reprocessing — gets to try the delivery once more.
      if (
        existing.status === NotificationStatus.FAILED &&
        input.mail &&
        existing.attempts < MAX_DELIVERY_ATTEMPTS
      ) {
        return { ...(await this.deliver(existing.id, input.recipient, input.mail)), retried: true };
      }

      // Otherwise it is already queued or delivered by another caller
      // (duplicate webhook, reconciliation racing the webhook).
      return { id: existing.id, status: existing.status, duplicate: true };
    }

    let log;
    try {
      log = await this.prisma.notificationLog.create({
        data: {
          userId: input.userId,
          type: input.type,
          event: input.event,
          recipient: input.recipient,
          payload: input.payload,
          dedupeKey: input.dedupeKey,
          status: NotificationStatus.PENDING
        }
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        // Lost the race against a concurrent caller. That caller owns the send.
        return { id: undefined, status: NotificationStatus.PENDING, duplicate: true };
      }
      throw error;
    }

    if (!input.mail || input.type !== NotificationType.EMAIL) {
      // No delivery channel wired for this type yet — the row stays as the record.
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: NotificationStatus.SKIPPED }
      });
      return { id: log.id, status: NotificationStatus.SKIPPED, duplicate: false };
    }

    return this.deliver(log.id, input.recipient, input.mail);
  }

  private async deliver(logId: string, recipient: string, mail: MailBody) {
    try {
      const result = await this.mail.send({ to: recipient, ...mail });
      const status = result.status === "SENT" ? NotificationStatus.SENT : NotificationStatus.SKIPPED;

      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: {
          status,
          attempts: { increment: 1 },
          deliveredAt: status === NotificationStatus.SENT ? new Date() : null,
          lastError: status === NotificationStatus.SENT ? null : "SMTP nao configurado."
        }
      });

      if (status === NotificationStatus.SKIPPED) {
        this.logger.warn(`[Notification] SMTP nao configurado, e-mail nao enviado (log ${logId}).`);
      }

      return { id: logId, status, duplicate: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: {
          status: NotificationStatus.FAILED,
          attempts: { increment: 1 },
          lastError: message.slice(0, 500)
        }
      });
      // Never rethrow: a mail outage must not roll back an approved payment.
      this.logger.error(`[Notification] Falha ao enviar o log ${logId}: ${message}`);
      return { id: logId, status: NotificationStatus.FAILED, duplicate: false };
    }
  }

  /**
   * Called once per real PENDING -> PAID transition, from PaymentsService.
   * Safe to call again: the dedupe key keeps it to a single message per order.
   */
  async sendPurchaseApproved(input: PurchaseApprovedInput) {
    const mail = renderPurchaseConfirmed({
      buyerName: input.buyerName,
      eventTitle: input.eventTitle,
      eventStartsAt: input.eventStartsAt,
      orderId: input.orderId,
      ticketCount: input.ticketCount,
      orderUrl: this.orderUrl(input.orderId, input.orderAccessToken),
      createAccountUrl: this.appUrl("/register")
    });

    const payload = {
      orderId: input.orderId,
      eventTitle: input.eventTitle,
      ticketCount: input.ticketCount
    };

    const email = await this.send({
      userId: input.userId,
      type: NotificationType.EMAIL,
      event: NotificationEvent.PURCHASE_CONFIRMED,
      recipient: input.email,
      payload,
      dedupeKey: `purchase-confirmed:${input.orderId}`,
      mail
    });

    const whatsapp = input.phone
      ? await this.send({
          userId: input.userId,
          type: NotificationType.WHATSAPP,
          event: NotificationEvent.PAYMENT_APPROVED,
          recipient: input.phone,
          payload,
          dedupeKey: `payment-approved-whatsapp:${input.orderId}`
        })
      : null;

    return { email, whatsapp };
  }

  list(query: { userId?: string; event?: NotificationEvent; type?: NotificationType }) {
    return this.prisma.notificationLog.findMany({
      where: { userId: query.userId, event: query.event, type: query.type },
      orderBy: { sentAt: "desc" },
      take: 100
    });
  }

  private isUniqueViolation(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === PRISMA_UNIQUE_VIOLATION
    );
  }

  private appUrl(path: string) {
    const base = (this.config.get<string>("APP_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
    return `${base}${path}`;
  }

  private orderUrl(orderId: string, accessToken?: string | null) {
    const params = new URLSearchParams({ orderId });
    if (accessToken) {
      params.set("accessToken", accessToken);
    }
    return `${this.appUrl("/checkout/success")}?${params.toString()}`;
  }
}
