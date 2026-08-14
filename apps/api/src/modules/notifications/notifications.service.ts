import { Injectable, Logger } from "@nestjs/common";
import { NotificationEvent, NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type NotifyInput = {
  userId?: string;
  type: NotificationType;
  event: NotificationEvent;
  recipient: string;
  payload: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(input: NotifyInput) {
    const log = await this.prisma.notificationLog.create({ data: input });
    this.logger.log(`[Notification Dispatch] Channel: ${input.type} | Event: ${input.event} | Recipient: ${input.recipient} | LogID: ${log.id}`);

    return {
      id: log.id,
      status: "QUEUED",
      channel: input.type,
      event: input.event,
      recipient: input.recipient
    };
  }

  sendPurchaseApproved(input: { userId?: string; email: string; phone?: string; orderId: string; eventTitle: string }) {
    return Promise.all([
      this.send({
        userId: input.userId,
        type: NotificationType.EMAIL,
        event: NotificationEvent.PURCHASE_CONFIRMED,
        recipient: input.email,
        payload: input
      }),
      input.phone
        ? this.send({
            userId: input.userId,
            type: NotificationType.WHATSAPP,
            event: NotificationEvent.PAYMENT_APPROVED,
            recipient: input.phone,
            payload: input
          })
        : Promise.resolve(null)
    ]);
  }

  list(query: { userId?: string; event?: NotificationEvent; type?: NotificationType }) {
    return this.prisma.notificationLog.findMany({
      where: { userId: query.userId, event: query.event, type: query.type },
      orderBy: { sentAt: "desc" },
      take: 100
    });
  }
}
