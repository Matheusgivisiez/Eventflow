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
  eventVenue: string;
  ticketCount: number;
  qrCodeLocked: boolean;
  qrCodeReleaseAt: Date | null;
  tickets: Array<{
    id: string;
    attendeeName: string;
    ticketTypeName: string;
    shortCode: string;
  }>;
};

export type TicketTransferDeliveredInput = {
  userId?: string;
  email: string;
  transferId: string;
  recipientName: string;
  senderName: string;
  orderId: string;
  eventTitle: string;
  eventStartsAt: Date;
  eventVenue: string;
  qrCodeLocked: boolean;
  qrCodeReleaseAt: Date | null;
  ticket: {
    id: string;
    attendeeName: string;
    ticketTypeName: string;
    shortCode: string;
  };
};

/** Prefix of the purchase confirmation dedupe key: `purchase-confirmed:<orderId>`. */
export const PURCHASE_CONFIRMED_DEDUPE_PREFIX = "purchase-confirmed:";

const PRISMA_UNIQUE_VIOLATION = "P2002";
export const MAX_DELIVERY_ATTEMPTS = 5;
/**
 * How long a claim is trusted. A row claimed within this window is being
 * delivered by someone right now; past it, the process that claimed it is
 * assumed dead and the delivery may be taken over.
 */
export const CLAIM_LEASE_MS = 1000 * 60 * 5;

/** Legacy response shape of POST /notifications. Do not change. */
export type EnqueuedNotification = {
  id?: string;
  status: "QUEUED";
  channel: NotificationType;
  event: NotificationEvent;
  recipient: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService
  ) {}

  async send(input: NotifyInput) {
    const deliverable = input.type === NotificationType.EMAIL && Boolean(input.mail);

    const existing = input.dedupeKey
      ? await this.prisma.notificationLog.findUnique({ where: { dedupeKey: input.dedupeKey } })
      : null;

    if (existing) {
      return this.resume(existing, input, deliverable);
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

    if (!deliverable) {
      // No transport wired for this channel yet. The row stays PENDING, which
      // is what the public API has always reported as QUEUED.
      return { id: log.id, status: NotificationStatus.PENDING, duplicate: false };
    }

    return this.attemptDelivery(log.id, log.attempts, input.recipient, input.mail!);
  }

  /**
   * Decides what to do with a row that already exists for this dedupe key.
   * Retries a failed delivery, and rescues a PENDING row that was abandoned by
   * a process that died before reaching SMTP.
   */
  private async resume(
    existing: {
      id: string;
      status: NotificationStatus;
      attempts: number;
      sentAt: Date;
      claimedAt: Date | null;
    },
    input: NotifyInput,
    deliverable: boolean
  ) {
    const duplicate = { id: existing.id, status: existing.status, duplicate: true };

    if (!deliverable) return duplicate;
    if (existing.attempts >= MAX_DELIVERY_ATTEMPTS) return duplicate;
    if (existing.status === NotificationStatus.SENT || existing.status === NotificationStatus.SKIPPED) {
      return duplicate;
    }

    // PENDING is the in-flight state: attemptDelivery moves the row there when
    // it claims it, whatever the row was before. So a PENDING row within its
    // lease belongs to someone who is sending right now, and only an expired
    // lease means the owner died. A FAILED row has no owner — the previous
    // attempt already finished and wrote the result — so it is free to retake.
    if (existing.status === NotificationStatus.PENDING) {
      const leaseStartedAt = existing.claimedAt ?? existing.sentAt;
      if (Date.now() - leaseStartedAt.getTime() <= CLAIM_LEASE_MS) {
        return duplicate;
      }
    }

    const result = await this.attemptDelivery(
      existing.id,
      existing.attempts,
      input.recipient,
      input.mail!
    );
    return { ...result, retried: true };
  }

  /**
   * Claims the row before touching SMTP.
   *
   * The claim is a single atomic write that does three things together:
   *
   * - moves the row to PENDING, the in-flight state. Without this a retry of a
   *   FAILED row stayed FAILED while the SMTP call was running, so the lease —
   *   which only applies to PENDING — never covered it and a second caller
   *   sent the message again.
   * - stamps `claimedAt`, which starts the lease resume() checks.
   * - increments `attempts`, which doubles as a compare-and-swap token: two
   *   callers that read the same value both try to increment it and only one
   *   update matches, covering callers that read at the same instant.
   *
   * The unique dedupe key stops a second row, never a second send.
   */
  private async attemptDelivery(
    logId: string,
    seenAttempts: number,
    recipient: string,
    mail: MailBody
  ) {
    const claimed = await this.prisma.notificationLog.updateMany({
      where: { id: logId, attempts: seenAttempts },
      data: {
        attempts: seenAttempts + 1,
        claimedAt: new Date(),
        status: NotificationStatus.PENDING
      }
    });

    if (claimed.count !== 1) {
      return { id: logId, status: NotificationStatus.PENDING, duplicate: true };
    }

    try {
      const result = await this.mail.send({ to: recipient, ...mail });
      const status = result.status === "SENT" ? NotificationStatus.SENT : NotificationStatus.SKIPPED;

      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: {
          status,
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
        data: { status: NotificationStatus.FAILED, lastError: message.slice(0, 500) }
      });
      // Never rethrow: a mail outage must not roll back an approved payment.
      this.logger.error(`[Notification] Falha ao enviar o log ${logId}: ${message}`);
      return { id: logId, status: NotificationStatus.FAILED, duplicate: false };
    }
  }

  /**
   * Public API entry point (POST /notifications). Keeps the response shape the
   * route has always returned; internal callers use send() instead.
   */
  async enqueue(input: {
    userId?: string;
    type: NotificationType;
    event: NotificationEvent;
    recipient: string;
    payload: Prisma.InputJsonValue;
  }): Promise<EnqueuedNotification> {
    const result = await this.send(input);

    return {
      id: result.id,
      status: "QUEUED",
      channel: input.type,
      event: input.event,
      recipient: input.recipient
    };
  }

  /** Delivery state of the purchase confirmation for an order, if any. */
  async purchaseConfirmationStatus(orderId: string) {
    const log = await this.prisma.notificationLog.findUnique({
      where: { dedupeKey: `${PURCHASE_CONFIRMED_DEDUPE_PREFIX}${orderId}` },
      select: { status: true, recipient: true }
    });
    return log ?? null;
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
      eventVenue: input.eventVenue,
      orderId: input.orderId,
      ticketCount: input.ticketCount,
      orderUrl: this.orderUrl(input.orderId, input.orderAccessToken),
      createAccountUrl: this.appUrl("/register"),
      qrCodeLocked: input.qrCodeLocked,
      qrCodeReleaseAt: input.qrCodeReleaseAt,
      logoLightUrl: this.appUrl("/images/eventflow-logo-purple-black.png"),
      logoDarkUrl: this.appUrl("/images/eventflow-logo-purple-white.png"),
      qrLockedImageUrl: this.appUrl("/images/eventflow-ticket-qr-locked.png"),
      assetsBaseUrl: this.appUrl("/images/email"),
      tickets: input.tickets.map((ticket) => ({
        id: ticket.id,
        attendeeName: ticket.attendeeName,
        ticketTypeName: ticket.ticketTypeName,
        shortCode: ticket.shortCode,
        pdfUrl: this.ticketPdfUrl(input.orderId, ticket.id, input.orderAccessToken)
      }))
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
      dedupeKey: `${PURCHASE_CONFIRMED_DEDUPE_PREFIX}${input.orderId}`,
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

  /**
   * Called once per transfer acceptance, from TransfersService. Delivers the
   * ticket to the new owner the same way a purchase does — same ticket-card
   * e-mail, same QR-locked-placeholder security model — instead of leaving
   * them with only the in-app "meus ingressos" list to notice it arrived.
   * Safe to call again: the dedupe key keeps it to one message per transfer.
   */
  async sendTicketTransferDelivered(input: TicketTransferDeliveredInput) {
    const myTicketsUrl = this.appUrl("/me/ingressos");
    const mail = renderPurchaseConfirmed({
      buyerName: input.recipientName,
      eventTitle: input.eventTitle,
      eventStartsAt: input.eventStartsAt,
      eventVenue: input.eventVenue,
      orderId: input.orderId,
      ticketCount: 1,
      orderUrl: myTicketsUrl,
      createAccountUrl: myTicketsUrl,
      qrCodeLocked: input.qrCodeLocked,
      qrCodeReleaseAt: input.qrCodeReleaseAt,
      logoLightUrl: this.appUrl("/images/eventflow-logo-purple-black.png"),
      logoDarkUrl: this.appUrl("/images/eventflow-logo-purple-white.png"),
      qrLockedImageUrl: this.appUrl("/images/eventflow-ticket-qr-locked.png"),
      assetsBaseUrl: this.appUrl("/images/email"),
      transfer: { fromName: input.senderName },
      tickets: [
        {
          id: input.ticket.id,
          attendeeName: input.ticket.attendeeName,
          ticketTypeName: input.ticket.ticketTypeName,
          shortCode: input.ticket.shortCode,
          // Receiver is an authenticated user, not a guest with an
          // order-access token — send them to their own ticket list
          // rather than a bare, unauthenticated API download link.
          pdfUrl: myTicketsUrl
        }
      ]
    });

    return this.send({
      userId: input.userId,
      type: NotificationType.EMAIL,
      event: NotificationEvent.TICKET_TRANSFER_ACCEPTED,
      recipient: input.email,
      payload: { transferId: input.transferId, ticketId: input.ticket.id, orderId: input.orderId },
      dedupeKey: `ticket-transfer-delivered:${input.transferId}`,
      mail
    });
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

  private apiUrl(path: string) {
    const base = (this.config.get<string>("API_URL") ?? "http://localhost:3001").replace(/\/+$/, "");
    return `${base}${path}`;
  }

  private orderUrl(orderId: string, accessToken?: string | null) {
    const params = new URLSearchParams({ orderId });
    if (accessToken) {
      params.set("accessToken", accessToken);
    }
    return `${this.appUrl("/checkout/success")}?${params.toString()}`;
  }

  /**
   * Guest-safe PDF link for a single ticket, authorized by the order's
   * access token (see CheckoutService.ticketPdf) — never a session, so it
   * still works for a buyer who never created an account.
   */
  private ticketPdfUrl(orderId: string, ticketId: string, accessToken?: string | null) {
    const params = new URLSearchParams();
    if (accessToken) {
      params.set("accessToken", accessToken);
    }
    const query = params.toString();
    return `${this.apiUrl(`/checkout/order/${orderId}/tickets/${ticketId}/pdf`)}${query ? `?${query}` : ""}`;
  }
}
