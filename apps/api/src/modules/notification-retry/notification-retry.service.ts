import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationEvent, NotificationStatus, NotificationType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PURCHASE_CONFIRMED_DEDUPE_PREFIX } from "../notifications/notifications.service";
import { PaymentsService } from "../payments/payments.service";

const RETRY_INTERVAL_MS = 120_000;
/** Same window the delivery lease uses: below it, someone may still be sending. */
const CLAIM_LEASE_MS = 1000 * 60 * 5;
/** Rows older than this are history, not a delivery someone is still waiting for. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const BATCH_SIZE = 50;

/**
 * Re-drives purchase confirmations that got stuck.
 *
 * Until this existed, a delivery only got another chance when something else
 * touched the order again — a replayed webhook, a reconciliation. If the SMTP
 * server blinked and nothing else happened to that order, the buyer simply
 * never received the link to their ticket.
 *
 * It re-drives through PaymentsService.dispatchPurchaseConfirmed, so every
 * guard still applies: the PURCHASE_EMAIL_ENABLED flag, the order having to be
 * PAID, the dedupe key, the claim lease and the attempts ceiling. This service
 * decides *when* to try again, never *whether* it is safe to send.
 */
@Injectable()
export class NotificationRetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationRetryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService
  ) {}

  onModuleInit() {
    if (this.config.get<boolean>("NOTIFICATION_RETRY_ENABLED") === false) {
      this.logger.log("Retentativa de notificacoes desabilitada por configuracao.");
      return;
    }

    this.timer = setInterval(() => void this.retryStuckNotifications(), RETRY_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async retryStuckNotifications(now = new Date()) {
    // One pass at a time: a slow SMTP server must not stack up overlapping runs.
    if (this.running) return { retried: 0, skipped: true };
    this.running = true;

    try {
      const leaseCutoff = new Date(now.getTime() - CLAIM_LEASE_MS);
      const ageCutoff = new Date(now.getTime() - MAX_AGE_MS);

      const stuck = await this.prisma.notificationLog.findMany({
        where: {
          type: NotificationType.EMAIL,
          event: NotificationEvent.PURCHASE_CONFIRMED,
          dedupeKey: { startsWith: PURCHASE_CONFIRMED_DEDUPE_PREFIX },
          sentAt: { gte: ageCutoff },
          OR: [
            { status: NotificationStatus.FAILED },
            {
              status: NotificationStatus.PENDING,
              OR: [{ claimedAt: { lt: leaseCutoff } }, { claimedAt: null, sentAt: { lt: leaseCutoff } }]
            }
          ]
        },
        select: { id: true, dedupeKey: true, attempts: true },
        orderBy: { sentAt: "asc" },
        take: BATCH_SIZE
      });

      let retried = 0;
      for (const row of stuck) {
        const orderId = row.dedupeKey?.slice(PURCHASE_CONFIRMED_DEDUPE_PREFIX.length);
        if (!orderId) continue;

        // dispatchPurchaseConfirmed never throws, but a failure to even load the
        // order must not stop the rest of the batch.
        try {
          await this.payments.dispatchPurchaseConfirmed(orderId);
          retried += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Falha ao reprocessar a notificacao ${row.id}: ${message}`);
        }
      }

      if (retried) {
        this.logger.log(`${retried} confirmacao(oes) de compra reprocessada(s).`);
      }

      return { retried, skipped: false };
    } finally {
      this.running = false;
    }
  }
}
