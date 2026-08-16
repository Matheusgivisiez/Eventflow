import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { EventStatus, PaymentStatus, Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { CouponsService } from "../../coupons/coupons.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { BusinessMetricsService } from "../../observability/business-metrics.service";
import type { CreateCheckoutDto } from "../dto/create-checkout.dto";

const PLATFORM_FEE_RATE = 0.08;

type ProcessedItem = {
  ticketType: { id: string; priceCents: number; name: string; quantity: number; sold: number; limitPerBuy: number; startsAt: Date; endsAt: Date; isActive: boolean };
  quantity: number;
  seatIds: string[];
  totalCents: number;
};

type CheckoutTx = Prisma.TransactionClient;
type CheckoutEvent = Prisma.EventGetPayload<{ include: { ticketTypes: true } }>;

@Injectable()
export class CreateCheckoutUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService,
    @Optional() private readonly metrics?: BusinessMetricsService
  ) {}

  async execute(slug: string, dto: CreateCheckoutDto, user?: RequestUser) {
    if (!dto.items.length) {
      throw new BadRequestException("Selecione pelo menos um ingresso.");
    }

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { slug, status: EventStatus.PUBLISHED },
        include: { ticketTypes: true }
      });

      if (!event) {
        throw new NotFoundException("Evento indisponivel.");
      }

      this.validateSalesPeriod(event);
      await this.validateCpfLimit(tx, event, dto);
      const couponResult = await this.processCoupon(tx, event, dto);
      const affiliateResult = await this.processAffiliate(tx, event, dto);
      const promoterResult = await this.processPromoter(tx, event, dto);

      const items = this.validateAndPrepareItems(event, dto, couponResult.couponDiscount);
      const { subtotalCents, discountCents, feeCents, totalCents } = this.calculatePricing(
        items, couponResult.couponDiscount, event.feeAbsorbedByOrganizer
      );
      await this.reserveStockTx(tx, items);

      const order = await tx.order.create({
        data: {
          eventId: event.id,
          userId: user?.id,
          couponId: couponResult.couponId,
          buyerName: dto.buyerName,
          buyerEmail: dto.buyerEmail.toLowerCase(),
          buyerDocument: dto.buyerDocument,
          buyerPhone: dto.buyerPhone,
          affiliateLinkId: affiliateResult.affiliateLinkId,
          promoterLinkId: promoterResult.promoterLinkId,
          promoterCommissionCents: promoterResult.promoterCommissionCents,
          source: dto.source,
          device: dto.device,
          campaign: dto.campaign,
          stockReservedAt: new Date(),
          subtotalCents,
          discountCents,
          feeCents,
          totalCents,
          status: PaymentStatus.PENDING,
          orderAccessToken: this.createOrderAccessToken(),
          items: {
            create: items.map((item) => ({
              ticketTypeId: item.ticketType.id,
              quantity: item.quantity,
              unitCents: item.ticketType.priceCents,
              totalCents: item.totalCents,
              seatIds: item.seatIds
            }))
          },
          payment: {
            create: {
              eventId: event.id,
              method: dto.paymentMethod,
              amountCents: totalCents,
              provider: "abacate_pay"
            }
          }
        },
        include: { payment: true, items: { include: { ticketType: true } } }
      });

      if (affiliateResult.affiliateLinkId && affiliateResult.affiliateCommissionBps > 0) {
        await this.createAffiliateCommission(tx, event.tenantId, affiliateResult as { affiliateLinkId: string; affiliateCommissionBps: number }, order.id, totalCents);
      }

      if (promoterResult.promoterLinkId && promoterResult.promoterCommissionCents > 0) {
        await tx.promoterLink.update({
          where: { id: promoterResult.promoterLinkId },
          data: { conversions: { increment: 1 }, revenueCents: { increment: totalCents }, commissionAcumCents: { increment: promoterResult.promoterCommissionCents } }
        });
      }

      this.metrics?.increment("eventflow_checkout_created_total", { method: dto.paymentMethod });

      return order;
    });
  }

  private validateSalesPeriod(event: CheckoutEvent) {
    const now = new Date();
    if (event.salesStartsAt && now < event.salesStartsAt) {
      throw new BadRequestException("As vendas para este evento ainda nao comecaram.");
    }
    if (event.salesEndsAt && now > event.salesEndsAt) {
      throw new BadRequestException("As vendas para este evento ja foram encerradas.");
    }
  }

  private async validateCpfLimit(tx: CheckoutTx, event: CheckoutEvent, dto: CreateCheckoutDto) {
    if (!event.limitPerCpf || !dto.buyerDocument) return;

    const previousOrders = await tx.order.findMany({
      where: {
        eventId: event.id,
        buyerDocument: dto.buyerDocument,
        status: { not: PaymentStatus.CANCELED }
      },
      include: { items: true }
    });

    const previousTicketsCount = previousOrders.reduce(
      (sum, order) => sum + order.items.reduce((acc, item) => acc + item.quantity, 0),
      0
    );
    const currentTicketsCount = dto.items.reduce((sum, item) => sum + item.quantity, 0);

    if (previousTicketsCount + currentTicketsCount > event.limitPerCpf) {
      throw new BadRequestException(`Limite excedido. O limite e de ${event.limitPerCpf} ingressos por CPF/Documento.`);
    }
  }

  private async processCoupon(tx: CheckoutTx, event: CheckoutEvent, dto: CreateCheckoutDto) {
    let couponId: string | undefined;
    let couponDiscount = { discountPercent: 0, discountFixedCents: 0 };

    if (dto.couponCode) {
      const coupon = await tx.coupon.findUnique({ where: { code: dto.couponCode } });
      if (!coupon || !coupon.isActive) throw new NotFoundException("Cupom invalido ou inativo.");
      if (coupon.tenantId && coupon.tenantId !== event.tenantId) throw new NotFoundException("Cupom invalido para este evento.");

      const now = new Date();
      if (now < coupon.validFrom || now > coupon.validUntil) throw new BadRequestException("Cupom fora da data de validade.");
      if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) throw new BadRequestException("Cupom esgotado.");

      couponId = coupon.id;
      couponDiscount = { discountPercent: coupon.discountPercent, discountFixedCents: coupon.discountFixedCents };

      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } }
      });
    }

    return { couponId, couponDiscount };
  }

  private async processAffiliate(tx: CheckoutTx, event: CheckoutEvent, dto: CreateCheckoutDto) {
    let affiliateLinkId: string | undefined;
    let affiliateCommissionBps = 0;

    if (dto.affiliateCode) {
      const affiliateLink = await tx.affiliateLink.findFirst({
        where: { code: dto.affiliateCode, tenantId: event.tenantId, isActive: true }
      });
      if (affiliateLink) {
        affiliateLinkId = affiliateLink.id;
        affiliateCommissionBps = affiliateLink.commissionBps;
        await tx.affiliateLink.update({
          where: { id: affiliateLink.id },
          data: { clicks: { increment: 1 } }
        });
      }
    }

    return { affiliateLinkId, affiliateCommissionBps };
  }

  private async processPromoter(tx: CheckoutTx, event: CheckoutEvent, dto: CreateCheckoutDto) {
    let promoterLinkId: string | undefined;
    let promoterCommissionCents = 0;

    if (dto.promoterCode) {
      const promoterLink = await tx.promoterLink.findFirst({
        where: { code: dto.promoterCode, eventId: event.id, isActive: true }
      });
      if (promoterLink) {
        promoterLinkId = promoterLink.id;
        
        // Calculate subtotal for commission logic. Simple for now.
        const totalQty = dto.items.reduce((s, i) => s + i.quantity, 0);
        const subtotal = dto.items.reduce((s, i) => {
          const t = event.ticketTypes.find((tt) => tt.id === i.ticketTypeId);
          return s + (t ? t.priceCents * i.quantity : 0);
        }, 0);

        if (promoterLink.commissionType === "PERCENTAGE") {
          promoterCommissionCents = Math.round(subtotal * (promoterLink.commissionValue / 10000));
        } else if (promoterLink.commissionType === "FIXED") {
          promoterCommissionCents = promoterLink.commissionValue * totalQty;
        }

        await tx.promoterLink.update({
          where: { id: promoterLink.id },
          data: { clicks: { increment: 1 } }
        });
      }
    }

    return { promoterLinkId, promoterCommissionCents };
  }

  private validateAndPrepareItems(event: CheckoutEvent, dto: CreateCheckoutDto, couponDiscount: { discountPercent: number; discountFixedCents: number }): ProcessedItem[] {
    const now = new Date();

    return dto.items.map((item) => {
      const ticketType = event.ticketTypes.find((t) => t.id === item.ticketTypeId);
      if (!ticketType || !ticketType.isActive) {
        throw new BadRequestException("Lote de ingresso indisponivel.");
      }
      if (item.quantity > ticketType.limitPerBuy) {
        throw new BadRequestException(`Limite de ${ticketType.limitPerBuy} ingressos por compra para ${ticketType.name}.`);
      }
      if (now < ticketType.startsAt || now > ticketType.endsAt) {
        throw new BadRequestException(`As vendas do lote ${ticketType.name} nao estao abertas.`);
      }
      if (ticketType.quantity - ticketType.sold < item.quantity) {
        throw new BadRequestException(`Nao ha ingressos suficientes para ${ticketType.name}.`);
      }
      if (item.seatIds?.length && item.seatIds.length !== item.quantity) {
        throw new BadRequestException(`Selecione ${item.quantity} assentos para ${ticketType.name}.`);
      }

      return {
        ticketType,
        quantity: item.quantity,
        seatIds: item.seatIds ?? [],
        totalCents: item.quantity * ticketType.priceCents
      };
    });
  }

  private async reserveStockTx(tx: CheckoutTx, items: ProcessedItem[]) {
    for (const item of items) {
      const updated = await tx.ticketType.updateMany({
        where: {
          id: item.ticketType.id,
          sold: { lte: item.ticketType.quantity - item.quantity }
        },
        data: {
          sold: { increment: item.quantity }
        }
      });

      if (updated.count !== 1) {
        this.metrics?.increment("eventflow_checkout_inventory_conflicts_total", { reason: "insufficient_stock" });
        throw new BadRequestException(`Nao ha ingressos suficientes para ${item.ticketType.name}.`);
      }
    }
  }

  private createOrderAccessToken() {
    return randomBytes(32).toString("base64url");
  }

  private calculatePricing(
    items: ProcessedItem[],
    couponDiscount: { discountPercent: number; discountFixedCents: number },
    feeAbsorbedByOrganizer: boolean
  ) {
    const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
    const discountCents = this.coupons.calculateDiscount(subtotalCents, couponDiscount);
    const discountedSubtotal = subtotalCents - discountCents;
    const feeCents = Math.round(discountedSubtotal * PLATFORM_FEE_RATE);
    const totalCents = feeAbsorbedByOrganizer ? discountedSubtotal : discountedSubtotal + feeCents;

    return { subtotalCents, discountCents, feeCents, totalCents };
  }
  private async createAffiliateCommission(
    tx: CheckoutTx,
    tenantId: string,
    affiliateResult: { affiliateLinkId: string; affiliateCommissionBps: number },
    orderId: string,
    totalCents: number
  ) {
    const amountCents = Math.round(totalCents * (affiliateResult.affiliateCommissionBps / 10000));
    await tx.affiliateCommission.create({
      data: {
        tenantId,
        affiliateLinkId: affiliateResult.affiliateLinkId,
        orderId,
        amountCents,
        status: "PENDING",
        payableAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
      }
    });
    await tx.affiliateLink.update({
      where: { id: affiliateResult.affiliateLinkId },
      data: { conversions: { increment: 1 }, revenueCents: { increment: totalCents } }
    });
  }
}
