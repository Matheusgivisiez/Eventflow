import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional, UnauthorizedException } from "@nestjs/common";
import { EventStatus, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { createHash } from "node:crypto";
import { CouponsService } from "../../coupons/coupons.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { SALE_ONLY } from "../../../common/utils/ticket-origin";
import { isPerfDiagnosticsEnabled, PhaseTimer } from "../../../common/diagnostics/perf-diagnostics";
import { BusinessMetricsService } from "../../observability/business-metrics.service";
import type { CreateCheckoutDto } from "../dto/create-checkout.dto";
import { hasReachedSalesEnd } from "../sales-limit";
import { getVisibleTicketLots, markOpenedLots } from "../ticket-lots";

const PLATFORM_FEE_RATE = 0.08;

type ProcessedItem = {
  ticketType: { id: string; priceCents: number; name: string; quantity: number; sold: number; limitPerBuy: number; startsAt: Date; endsAt: Date; isActive: boolean };
  quantity: number;
  seatIds: string[];
  totalCents: number;
  availableQuantity: number;
};

type CheckoutTx = Prisma.TransactionClient;
type CheckoutEvent = Prisma.EventGetPayload<{ include: { ticketTypes: true } }>;

@Injectable()
export class CreateCheckoutUseCase {
  private readonly logger = new Logger(CreateCheckoutUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService,
    @Optional() private readonly metrics?: BusinessMetricsService
  ) {}

  async execute(slug: string, dto: CreateCheckoutDto, user?: RequestUser) {
    // Compra só com conta logada e e-mail confirmado. O e-mail do pedido é
    // sempre o da conta: assim ninguém compra num endereço e cria a conta em
    // outro, e os ingressos aparecem na conta pelo userId e pelo e-mail.
    if (!user) {
      throw new UnauthorizedException("Entre na sua conta para comprar.");
    }
    if (!user.emailVerified) {
      throw new ForbiddenException("Confirme seu e-mail para comprar.");
    }
    const accountUserId = user.id;
    const accountEmail = user.email.trim().toLowerCase();

    if (!dto.items.length) {
      throw new BadRequestException("Selecione pelo menos um ingresso.");
    }
    const normalizedBuyerDocument = this.onlyDigits(dto.buyerDocument ?? "");
    const normalizedBuyerPhone = this.onlyDigits(dto.buyerPhone ?? "");

    if (!this.isValidCpfOrCnpj(normalizedBuyerDocument)) {
      throw new BadRequestException("Informe um CPF ou CNPJ válido.");
    }
    if (!this.isValidBrazilianPhone(normalizedBuyerPhone)) {
      throw new BadRequestException("Informe um telefone com DDD.");
    }
    const normalizedBuyerName = (dto.buyerName ?? "").trim().replace(/\s+/g, " ");
    // A InfinitePay recusa o link inteiro ("Invalid checkout link params")
    // quando o nome do cliente tem uma palavra só. Barrar aqui evita criar um
    // pedido que nunca vai conseguir gerar o PIX.
    if (!this.hasFullName(normalizedBuyerName)) {
      throw new BadRequestException("Informe nome e sobrenome.");
    }

    const normalizedDto = {
      ...dto,
      buyerEmail: accountEmail,
      buyerName: normalizedBuyerName,
      buyerDocument: normalizedBuyerDocument,
      buyerPhone: normalizedBuyerPhone,
      paymentMethod: PaymentMethod.PIX
    };

    // Read-only lookups run OUTSIDE the write transaction on purpose: they don't need to
    // hold a DB transaction slot, and keeping them out shrinks how long the transaction below
    // holds its row lock on the hot TicketType row under concurrent checkouts for the same event.
    const timer = isPerfDiagnosticsEnabled() ? new PhaseTimer() : undefined;
    const event = await this.prisma.event.findFirst({
      where: {
        slug, status: EventStatus.PUBLISHED,
        OR: [
          { isPrivate: false },
          ...(dto.inviteToken ? [{ isPrivate: true, inviteTokenHash: createHash("sha256").update(dto.inviteToken).digest("hex") }] : [])
        ]
      },
      // Só lotes de venda. Os tipos internos de cortesia nunca entram no checkout.
      include: { ticketTypes: { where: SALE_ONLY } }
    });
    timer?.lap("eventLookup");

    if (!event) {
      throw new NotFoundException("Evento indisponível.");
    }

    this.validateSalesPeriod(event);
    await this.validateCpfLimit(this.prisma, event, normalizedDto);
    const items = this.validateAndPrepareItems(event, normalizedDto);
    timer?.lap("cpfLimitAndValidation");

    // The counter UPDATEs in this transaction (the lot's `sold`, a coupon's `usedCount`, affiliate/
    // promoter `clicks`) take row locks that every concurrent buyer of the same lot/coupon/link
    // needs, and Postgres holds them until COMMIT. Run first, those locks are held across every later
    // statement (order/items/payment inserts + the include read-back) — many DB round-trips — and
    // concurrent checkouts for the same lot serialize behind them.
    // So all of those writes run at the end, right before COMMIT, with the most contended one (the
    // lot's stock) last, so the locks are held for ~1-3 round-trips. Measured in production with 20
    // concurrent buyers of one lot: p50 12.0s -> 3.8s. Atomicity is unchanged: a failed reservation
    // throws and rolls back the whole transaction, including the order created before it.
    // CHECKOUT_HOT_ROW_WRITES_LAST=false restores the old order (kill switch only).
    const hotRowWritesLast = process.env.CHECKOUT_HOT_ROW_WRITES_LAST !== "false";

    // Everything below MUST be atomic together (stock reservation + order/payment creation),
    // so it stays inside a single transaction. maxWait/timeout are raised above the Prisma
    // defaults (2s/5s) so a burst of concurrent checkouts for the same ticket type queues for a
    // free connection/lock instead of failing outright with a transaction-timeout error.
    try {
      const createdOrder = await this.prisma.$transaction(async (tx) => {
        timer?.lap("txAcquire");
        const couponResult = await this.processCoupon(tx, event, normalizedDto, hotRowWritesLast);
        const affiliateResult = await this.processAffiliate(tx, event, normalizedDto, hotRowWritesLast);
        const promoterResult = await this.processPromoter(tx, event, normalizedDto, hotRowWritesLast);
        timer?.lap("couponAffiliatePromoter");

        const { subtotalCents, discountCents, feeCents, totalCents } = this.calculatePricing(
          items, couponResult.couponDiscount, event.feeAbsorbedByOrganizer
        );
        // Pedido de total zero não tem o atrito do pagamento. Se o organizador não definiu
        // um limite por CPF, vale o padrão: um CPF só acumula, em pedidos gratuitos e pagos
        // somados, o que cabe em uma única compra do lote. Pedidos pagos não mudam em nada.
        if (totalCents === 0 && !event.limitPerCpf) {
          await this.validateCpfLimit(tx, event, normalizedDto, Math.max(...items.map((item) => item.ticketType.limitPerBuy)));
        }
        if (!hotRowWritesLast) {
          await this.reserveStockTx(tx, items);
          timer?.lap("reserveStock");
        }

        const order = await tx.order.create({
          data: {
            eventId: event.id,
            userId: accountUserId,
            couponId: couponResult.couponId,
            buyerName: normalizedDto.buyerName,
            buyerEmail: normalizedDto.buyerEmail,
            buyerDocument: normalizedDto.buyerDocument,
            buyerPhone: normalizedDto.buyerPhone,
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
                method: normalizedDto.paymentMethod,
                amountCents: totalCents,
                provider: "abacate_pay"
              }
            }
          },
          include: { payment: true, items: { include: { ticketType: true } } }
        });
        timer?.lap("orderCreate");

        if (affiliateResult.affiliateLinkId && affiliateResult.affiliateCommissionBps > 0) {
          await this.createAffiliateCommission(tx, event.tenantId, affiliateResult as { affiliateLinkId: string; affiliateCommissionBps: number }, order.id, totalCents);
          timer?.lap("affiliateCommission");
        }

        if (hotRowWritesLast) {
          // Least contended first; the lot's stock row (shared by every buyer of the lot) last.
          await affiliateResult.deferredWrite?.();
          await promoterResult.deferredWrite?.();
          await couponResult.deferredWrite?.();
          await this.reserveStockTx(tx, items);
          timer?.lap("hotRowWrites");
        }

        // NOTE: Promoter commission (commissionAcumCents, conversions, revenueCents) is credited
        // only when payment is confirmed as PAID in PaymentsService.markPaid().
        // This ensures financial integrity — no commission for unpaid or cancelled orders.

        this.metrics?.increment("eventflow_checkout_created_total", { method: normalizedDto.paymentMethod });

        return order;
      }, { maxWait: 10000, timeout: 15000 });
      timer?.lap("commit");
      if (timer) {
        this.logger.log(`checkout.tx order=${createdOrder.id} hotRowWritesLast=${hotRowWritesLast} ${timer.format()}`);
      }
      await this.markOpenedLots(event);
      return createdOrder;
    } catch (error) {
      if (timer) {
        timer.lap("failedAt");
        this.logger.warn(`checkout.tx failed hotRowWritesLast=${hotRowWritesLast} ${timer.format()} error=${(error as Error)?.message}`);
      }
      throw error;
    }
  }

  private validateSalesPeriod(event: CheckoutEvent) {
    const now = new Date();
    if (event.salesStartsAt && now < event.salesStartsAt) {
      throw new BadRequestException("As vendas para este evento ainda não começaram.");
    }
    if (event.salesEndsAt && now > event.salesEndsAt) {
      throw new BadRequestException("As vendas para este evento já foram encerradas.");
    }
  }

  private onlyDigits(value: string) {
    return value.replace(/\D/g, "");
  }

  private hasFullName(value: string) {
    return value.split(" ").filter((part) => /\p{L}.*\p{L}/u.test(part)).length >= 2;
  }

  private isValidBrazilianPhone(value: string) {
    return /^\d{10,11}$/.test(value);
  }

  private isValidCpfOrCnpj(value: string) {
    return this.isValidCpf(value) || this.isValidCnpj(value);
  }

  private isValidCpf(value: string) {
    if (!/^\d{11}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
    const calc = (factor: number) => {
      const total = value.slice(0, factor - 1).split("").reduce((sum, digit, index) => sum + Number(digit) * (factor - index), 0);
      const rest = (total * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    return calc(10) === Number(value[9]) && calc(11) === Number(value[10]);
  }

  private isValidCnpj(value: string) {
    if (!/^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
    const calc = (base: string, weights: number[]) => {
      const total = base.split("").reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
      const rest = total % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    const first = calc(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = calc(value.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return first === Number(value[12]) && second === Number(value[13]);
  }

  private async validateCpfLimit(tx: CheckoutTx, event: CheckoutEvent, dto: CreateCheckoutDto, fallbackLimit?: number) {
    const limit = event.limitPerCpf || fallbackLimit;
    if (!limit || !dto.buyerDocument) return;

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

    if (previousTicketsCount + currentTicketsCount > limit) {
      throw new BadRequestException(`Limite excedido. O limite e de ${limit} ingressos por CPF/Documento.`);
    }
  }

  /**
   * Hot-row counter writes are returned as `deferredWrite` instead of being executed when
   * `deferWrites` is true, so the caller can run them right before COMMIT.
   */
  private async processCoupon(tx: CheckoutTx, event: CheckoutEvent, dto: CreateCheckoutDto, deferWrites = false) {
    let couponId: string | undefined;
    let couponDiscount = { discountPercent: 0, discountFixedCents: 0 };
    let deferredWrite: (() => Promise<void>) | undefined;

    const couponCode = dto.couponCode ? CouponsService.normalizeCode(dto.couponCode) : "";
    if (couponCode) {
      const coupon = await tx.coupon.findUnique({ where: { code: couponCode }, include: { events: true } });
      if (!coupon || !coupon.isActive) throw new NotFoundException("Cupom inválido ou inativo.");
      if (coupon.tenantId && coupon.tenantId !== event.tenantId) throw new NotFoundException("Cupom inválido para este evento.");
      if (coupon.tenantId && (!coupon.ownerId || coupon.ownerId !== event.ownerId)) throw new NotFoundException("Cupom inválido para este evento.");
      if (!CouponsService.appliesToEvent(coupon, event.id)) throw new NotFoundException("Cupom inválido para este evento.");

      const now = new Date();
      if (now < coupon.validFrom || now > coupon.validUntil) throw new BadRequestException("Cupom fora da data de validade.");
      if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) throw new BadRequestException("Cupom esgotado.");

      couponId = coupon.id;
      couponDiscount = { discountPercent: coupon.discountPercent, discountFixedCents: coupon.discountFixedCents };

      const reserveCoupon = async () => {
        const reservedCoupon = await tx.coupon.updateMany({
          where: coupon.maxUses > 0 ? { id: coupon.id, usedCount: { lt: coupon.maxUses } } : { id: coupon.id },
          data: { usedCount: { increment: 1 } }
        });
        if (reservedCoupon.count !== 1) throw new BadRequestException("Cupom esgotado.");
      };
      if (deferWrites) {
        deferredWrite = reserveCoupon;
      } else {
        await reserveCoupon();
      }
    }

    return { couponId, couponDiscount, deferredWrite };
  }

  private async processAffiliate(tx: CheckoutTx, event: CheckoutEvent, dto: CreateCheckoutDto, deferWrites = false) {
    let affiliateLinkId: string | undefined;
    let affiliateCommissionBps = 0;
    let deferredWrite: (() => Promise<void>) | undefined;

    if (dto.affiliateCode) {
      const affiliateLink = await tx.affiliateLink.findFirst({
        where: { code: dto.affiliateCode, tenantId: event.tenantId, isActive: true }
      });
      if (affiliateLink) {
        affiliateLinkId = affiliateLink.id;
        affiliateCommissionBps = affiliateLink.commissionBps;
        const countClick = async () => {
          await tx.affiliateLink.update({
            where: { id: affiliateLink.id },
            data: { clicks: { increment: 1 } }
          });
        };
        if (deferWrites) {
          deferredWrite = countClick;
        } else {
          await countClick();
        }
      }
    }

    return { affiliateLinkId, affiliateCommissionBps, deferredWrite };
  }

  private async processPromoter(tx: CheckoutTx, event: CheckoutEvent, dto: CreateCheckoutDto, deferWrites = false) {
    let promoterLinkId: string | undefined;
    let promoterCommissionCents = 0;
    let deferredWrite: (() => Promise<void>) | undefined;

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

        const countClick = async () => {
          await tx.promoterLink.update({
            where: { id: promoterLink.id },
            data: { clicks: { increment: 1 } }
          });
        };
        if (deferWrites) {
          deferredWrite = countClick;
        } else {
          await countClick();
        }
      }
    }

    return { promoterLinkId, promoterCommissionCents, deferredWrite };
  }

  private validateAndPrepareItems(event: CheckoutEvent, dto: CreateCheckoutDto): ProcessedItem[] {
    const now = new Date();
    const availableLots = this.getVisibleTicketLots(event.ticketTypes, now);
    const currentLot = availableLots.find((lot) => lot.status === "current");

    return dto.items.map((item) => {
      const visibleLot = availableLots.find((lot) => lot.ticketType.id === item.ticketTypeId);
      if (!visibleLot || visibleLot.status !== "current" || !currentLot) {
        const requested = event.ticketTypes.find((ticketType) => ticketType.id === item.ticketTypeId);
        if (!currentLot && requested?.isActive && now < requested.startsAt) {
          throw new BadRequestException("As vendas deste lote ainda não começaram.");
        }
        throw new BadRequestException("Lote de ingresso indisponível.");
      }
      const { ticketType } = visibleLot;
      if (item.quantity > ticketType.limitPerBuy) {
        throw new BadRequestException(`Limite de ${ticketType.limitPerBuy} ingressos por compra para ${ticketType.name}.`);
      }
      if (hasReachedSalesEnd(ticketType.sold, ticketType.salesEndQuantity)) {
        throw new BadRequestException(`O lote ${ticketType.name} atingiu o limite de vendas.`);
      }
      if (visibleLot.availableQuantity < item.quantity) {
        throw new BadRequestException(`Não há ingressos suficientes para ${ticketType.name}.`);
      }
      if (item.seatIds?.length && item.seatIds.length !== item.quantity) {
        throw new BadRequestException(`Selecione ${item.quantity} assentos para ${ticketType.name}.`);
      }

      return {
        ticketType,
        quantity: item.quantity,
        seatIds: item.seatIds ?? [],
        totalCents: item.quantity * ticketType.priceCents,
        availableQuantity: visibleLot.availableQuantity
      };
    });
  }

  private async reserveStockTx(tx: CheckoutTx, items: ProcessedItem[]) {
    for (const item of items) {
      const updated = await tx.ticketType.updateMany({
        where: {
          id: item.ticketType.id,
          sold: { lte: item.ticketType.sold + item.availableQuantity - item.quantity }
        },
        data: {
          sold: { increment: item.quantity }
        }
      });

      if (updated.count !== 1) {
        this.metrics?.increment("eventflow_checkout_inventory_conflicts_total", { reason: "insufficient_stock" });
        throw new BadRequestException(`Não há ingressos suficientes para ${item.ticketType.name}.`);
      }
    }
  }

  private getVisibleTicketLots(ticketTypes: CheckoutEvent["ticketTypes"], now: Date) {
    return getVisibleTicketLots(ticketTypes, now);
  }

  /**
   * Marca os lotes que esta reserva deixou abertos (ver markOpenedLots). Roda depois do
   * COMMIT, fora da transação, para não segurar o lock do lote e enxergar o estoque já
   * confirmado. Falha aqui não pode derrubar um pedido que já foi criado.
   */
  private async markOpenedLots(event: CheckoutEvent) {
    if (event.ticketTypes.every((ticketType) => !ticketType.isActive || ticketType.openedAt)) return;
    try {
      await markOpenedLots(this.prisma, event.id);
    } catch (error) {
      this.logger.warn(`checkout.markOpenedLots failed event=${event.id} error=${(error as Error)?.message}`);
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
