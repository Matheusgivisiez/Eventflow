import { Injectable, NotFoundException, ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentStatus } from "@prisma/client";
import { timingSafeEqual } from "node:crypto";
import { resolveClaimEmail } from "../../common/utils/claim-email.utils";
import type { RequestUser } from "../../common/types/request-user";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";

@Injectable()
export class PendingPurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly payments: PaymentsService
  ) {}

  private enabled() {
    return this.config.get<boolean>("PENDING_PURCHASES_ENABLED") === true;
  }

  private reservedUntil(stockReservedAt: Date) {
    const ttl = this.config.get<number>("ORDER_RESERVATION_TTL_MINUTES") ?? 60;
    return new Date(stockReservedAt.getTime() + ttl * 60_000);
  }

  private validCheckoutUrl(raw?: string | null) {
    if (!raw) return false;
    try {
      const url = new URL(raw);
      return url.protocol === "https:" && !url.username && !url.password &&
        (url.hostname === "infinitepay.io" || url.hostname.endsWith(".infinitepay.io"));
    } catch {
      return false;
    }
  }

  private tokenMatches(expected?: string | null, provided?: string | null) {
    if (!expected || !provided) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private ownsOrder(order: { userId: string | null; buyerEmail: string; orderAccessToken: string | null }, user?: RequestUser, token?: string) {
    if (user && (order.userId === user.id || (order.userId === null && resolveClaimEmail(user) === order.buyerEmail.toLowerCase()))) return true;
    return this.tokenMatches(order.orderAccessToken, token);
  }

  async list(user: RequestUser) {
    if (!this.enabled()) return [];
    const email = resolveClaimEmail(user);
    const cutoff = new Date(Date.now() - (this.config.get<number>("ORDER_RESERVATION_TTL_MINUTES") ?? 60) * 60_000);
    const orders = await this.prisma.order.findMany({
      where: {
        status: PaymentStatus.PENDING,
        stockReservedAt: { gt: cutoff },
        OR: [{ userId: user.id }, ...(email ? [{ userId: null, buyerEmail: email }] : [])],
        payment: { provider: "infinite_pay", checkoutUrl: { not: null } }
      },
      select: {
        id: true, stockReservedAt: true, totalCents: true,
        event: { select: { title: true, slug: true, startsAt: true, bannerUrl: true } },
        items: { select: { quantity: true, ticketType: { select: { name: true } } } },
        payment: { select: { checkoutUrl: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    return orders.filter((order) => order.stockReservedAt && this.validCheckoutUrl(order.payment?.checkoutUrl)).map((order) => ({
      id: order.id,
      event: order.event,
      items: order.items.map((item) => ({ name: item.ticketType.name, quantity: item.quantity })),
      totalCents: order.totalCents,
      reservedUntil: this.reservedUntil(order.stockReservedAt!).toISOString()
    }));
  }

  async resume(orderId: string, user?: RequestUser, accessToken?: string) {
    if (!this.enabled()) throw new NotFoundException("Pedido não encontrado.");
    const include = { payment: true, event: { select: { tenantId: true } } } as const;
    let order = await this.prisma.order.findUnique({ where: { id: orderId }, include });
    if (!order || !this.ownsOrder(order, user, accessToken)) throw new NotFoundException("Pedido não encontrado.");

    // A known transaction may have been paid while its webhook is still in flight.
    if (order.status === PaymentStatus.PENDING && order.payment?.checkoutId && order.payment.transactionId) {
      try {
        await this.payments.reconcileProviderStatus(order.payment.id, order.event.tenantId);
      } catch {
        throw new ServiceUnavailableException("Não foi possível conferir o pagamento agora. Tente novamente em instantes.");
      }
      order = await this.prisma.order.findUnique({ where: { id: orderId }, include });
    }

    if (!order || order.status !== PaymentStatus.PENDING || !order.stockReservedAt ||
      this.reservedUntil(order.stockReservedAt).getTime() <= Date.now()) {
      throw new ConflictException("A reserva deste pedido terminou ou o pagamento já foi concluído.");
    }
    if (order.payment?.provider !== "infinite_pay" || !this.validCheckoutUrl(order.payment.checkoutUrl)) {
      throw new ConflictException("Não há um pagamento retomável para este pedido.");
    }
    return { checkoutUrl: order.payment.checkoutUrl, reservedUntil: this.reservedUntil(order.stockReservedAt).toISOString() };
  }
}
