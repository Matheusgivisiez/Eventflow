import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { RequestUser } from "../../common/types/request-user";
import { getQrCodeReleaseTime, isQrCodeLocked } from "../../common/utils/qr-code.utils";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";
import { CreateCheckoutUseCase } from "./use-cases/create-checkout.use-case";

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly createCheckout: CreateCheckoutUseCase,
    private readonly payments: PaymentsService
  ) {}

  async create(slug: string, dto: CreateCheckoutDto, user?: RequestUser) {
    const order = await this.createCheckout.execute(slug, dto, user);
    let checkout: Awaited<ReturnType<PaymentsService["createProviderPreference"]>>;
    try {
      checkout = await this.payments.createProviderPreference(order.id);
    } catch (error) {
      await this.cancelOrderAfterProviderFailure(order.id);
      throw error;
    }

    return {
      ...order,
      orderId: order.id,
      orderAccessToken: order.orderAccessToken,
      status: order.status,
      checkoutUrl: checkout.checkoutUrl
    };
  }

  async getOrderStatus(orderId: string, accessToken?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        event: true,
        items: { include: { ticketType: true } },
        tickets: true,
        payment: true
      }
    });

    if (!order) {
      throw new NotFoundException("Pedido nao encontrado.");
    }
    if (!order.orderAccessToken || !accessToken || order.orderAccessToken !== accessToken) {
      throw new UnauthorizedException("Token de acesso do pedido invalido.");
    }

    const locked = isQrCodeLocked(order.event);
    const releaseTime = getQrCodeReleaseTime(order.event);

    return {
      id: order.id,
      eventId: order.eventId,
      eventTitle: order.event.title,
      eventStartsAt: order.event.startsAt,
      eventAddress: order.event.address,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      totalCents: order.totalCents,
      status: order.status,
      paymentMethod: order.payment?.method,
      createdAt: order.createdAt,
      items: order.items.map((i) => ({
        ticketTypeName: i.ticketType.name,
        quantity: i.quantity,
        totalCents: i.totalCents
      })),
      tickets: order.tickets.map((t) => ({
        uuid: locked ? null : t.uuid,
        attendeeName: t.attendeeName,
        qrCodeDataUrl: locked ? null : t.qrCodeDataUrl,
        status: t.status
      })),
      qrCodeLocked: locked,
      qrCodeReleaseAt: releaseTime?.toISOString() ?? null
    };
  }

  private async cancelOrderAfterProviderFailure(orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, payment: true }
      });

      if (!order || order.status !== PaymentStatus.PENDING) return;

      if (order.stockReservedAt) {
        for (const item of order.items) {
          await tx.ticketType.update({
            where: { id: item.ticketTypeId },
            data: { sold: { decrement: item.quantity } }
          });
        }
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: PaymentStatus.CANCELED, stockReservedAt: null }
      });

      if (order.payment) {
        await tx.payment.update({
          where: { orderId: order.id },
          data: { status: PaymentStatus.CANCELED, canceledAt: new Date() }
        });
      }
    });
  }
}
