import { ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentStatus } from "@prisma/client";
import { isPerfDiagnosticsEnabled, PhaseTimer } from "../../common/diagnostics/perf-diagnostics";
import { RequestUser } from "../../common/types/request-user";
import { getQrCodeReleaseTime, isQrCodeLocked } from "../../common/utils/qr-code.utils";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { PaymentsService } from "../payments/payments.service";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";
import { CreateCheckoutUseCase } from "./use-cases/create-checkout.use-case";

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly createCheckout: CreateCheckoutUseCase,
    private readonly payments: PaymentsService,
    private readonly cache: CacheService,
    private readonly config: ConfigService
  ) {}

  async create(slug: string, dto: CreateCheckoutDto, user?: RequestUser) {
    const timer = isPerfDiagnosticsEnabled() ? new PhaseTimer() : undefined;
    const order = await this.createCheckout.execute(slug, dto, user);
    timer?.lap("createOrder");
    let checkout: Awaited<ReturnType<PaymentsService["createProviderPreference"]>>;
    try {
      checkout = await this.payments.createProviderPreference(order.id);
    } catch (error) {
      await this.cancelOrderAfterProviderFailure(order.id);
      throw error;
    }
    timer?.lap("providerPreference");
    if (timer) {
      this.logger.log(`checkout.request order=${order.id} ${timer.format()}`);
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
    let order = await this.prisma.order.findUnique({
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

    if (order.status === PaymentStatus.PENDING && order.payment && await this.shouldReconcileOrder(order.id)) {
      try {
        await this.payments.reconcileProviderStatus(order.payment.id, order.event.tenantId);
        order = await this.prisma.order.findUnique({
          where: { id: orderId },
          include: {
            event: true,
            items: { include: { ticketType: true } },
            tickets: true,
            payment: true
          }
        });
      } catch {
        // Return the locally known state if the provider is temporarily unavailable.
      }
    }

    if (!order) {
      throw new NotFoundException("Pedido nao encontrado.");
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

  private async shouldReconcileOrder(orderId: string) {
    const cacheKey = `checkout:reconcile:${orderId}`;
    if (await this.cache.get(cacheKey)) return false;
    await this.cache.set(cacheKey, { checkedAt: Date.now() }, 15);
    return true;
  }

  async confirmSimulation(orderId: string, accessToken?: string) {
    const simulationEnabled = this.config.get<boolean>("PAYMENT_SIMULATION_ENABLED") ?? false;
    if (!simulationEnabled) {
      throw new ForbiddenException("A confirmação simulada está desabilitada neste ambiente.");
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { event: true, payment: true },
    });
    if (!order || !order.orderAccessToken || order.orderAccessToken !== accessToken) {
      throw new UnauthorizedException("Token de acesso do pedido inválido.");
    }
    if (!order.payment) {
      throw new NotFoundException("Pagamento do pedido não encontrado.");
    }
    if (order.status === PaymentStatus.PAID) {
      return { status: PaymentStatus.PAID };
    }
    if (order.status !== PaymentStatus.PENDING) {
      throw new ForbiddenException("Este pedido não pode ser confirmado.");
    }

    await this.payments.updateStatus(order.payment.id, order.event.tenantId, {
      status: PaymentStatus.PAID,
      providerRef: `sandbox:${order.id}`,
    });
    return { status: PaymentStatus.PAID };
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

      if (order.couponId) {
        await tx.coupon.updateMany({
          where: { id: order.couponId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } }
        });
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
