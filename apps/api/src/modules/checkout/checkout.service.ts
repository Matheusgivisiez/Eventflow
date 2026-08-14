import { Injectable, NotFoundException } from "@nestjs/common";
import { RequestUser } from "../../common/types/request-user";
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
    const checkout = await this.payments.createProviderPreference(order.id);

    return {
      ...order,
      orderId: order.id,
      status: order.status,
      checkoutUrl: checkout.checkoutUrl
    };
  }

  async getOrderStatus(orderId: string) {
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
        uuid: t.uuid,
        attendeeName: t.attendeeName,
        qrCodeDataUrl: t.qrCodeDataUrl,
        status: t.status
      }))
    };
  }
}
