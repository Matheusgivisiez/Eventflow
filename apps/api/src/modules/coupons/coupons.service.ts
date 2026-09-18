import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { UpdateCouponDto } from "./dto/update-coupon.dto";

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string | null, dto: CreateCouponDto) {
    this.validateDiscount(dto.discountPercent, dto.discountFixedCents, true);
    const code = CouponsService.normalizeCode(dto.code);
    if (!code) {
      throw new BadRequestException("Informe o codigo do cupom.");
    }
    const exists = await this.prisma.coupon.findUnique({ where: { code } });
    if (exists) {
      throw new BadRequestException("Cupom com este codigo ja existe.");
    }
    if (new Date(dto.validUntil) <= new Date(dto.validFrom)) {
      throw new BadRequestException("Data de validade deve ser posterior ao inicio.");
    }
    const eventIds = await this.resolveEventIds(tenantId, dto.eventIds);
    const { eventIds: _eventIds, ...couponFields } = dto;

    return this.prisma.coupon.create({
      data: {
        ...couponFields,
        code,
        tenantId,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        events: eventIds.length ? { create: eventIds.map((eventId) => ({ eventId })) } : undefined
      },
      include: { events: true }
    });
  }

  /**
   * Confere que os eventos escolhidos pertencem ao organizador antes de
   * restringir o cupom a eles. Um admin criando cupom global (tenantId nulo)
   * nao tem essa restricao.
   */
  private async resolveEventIds(tenantId: string | null, eventIds?: string[]) {
    const ids = Array.from(new Set((eventIds ?? []).filter(Boolean)));
    if (!ids.length || !tenantId) {
      return ids;
    }
    const owned = await this.prisma.event.findMany({
      where: { id: { in: ids }, tenantId },
      select: { id: true }
    });
    if (owned.length !== ids.length) {
      throw new BadRequestException("Um ou mais eventos selecionados nao pertencem a sua conta.");
    }
    return ids;
  }

  list(tenantId: string | null) {
    return this.prisma.coupon.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { events: { include: { event: { select: { id: true, title: true } } } } }
    });
  }

  async update(id: string, tenantId: string | null, dto: UpdateCouponDto) {
    this.validateDiscount(dto.discountPercent, dto.discountFixedCents, false);
    const coupon = await this.prisma.coupon.findFirst({ where: { id, tenantId } });
    if (!coupon) {
      throw new NotFoundException("Cupom nao encontrado.");
    }
    if (dto.validFrom && dto.validUntil && new Date(dto.validUntil) <= new Date(dto.validFrom)) {
      throw new BadRequestException("Data de validade deve ser posterior ao inicio.");
    }
    // undefined = nao mexe na restricao de eventos; [] = volta a valer pra todos.
    const eventIds = dto.eventIds === undefined ? undefined : await this.resolveEventIds(tenantId, dto.eventIds);
    const { eventIds: _eventIds, ...couponFields } = dto;

    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...couponFields,
        code: dto.code === undefined ? undefined : CouponsService.normalizeCode(dto.code),
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        events: eventIds === undefined ? undefined : {
          deleteMany: {},
          create: eventIds.map((eventId) => ({ eventId }))
        }
      },
      include: { events: true }
    });
  }

  async remove(id: string, tenantId: string | null) {
    const coupon = await this.prisma.coupon.findFirst({ where: { id, tenantId } });
    if (!coupon) {
      throw new NotFoundException("Cupom nao encontrado.");
    }
    await this.prisma.coupon.delete({ where: { id } });
    return { success: true };
  }

  /** Codigos sao salvos em maiusculas e sem espacos; o comprador pode digitar de qualquer jeito. */
  static normalizeCode(code: string) {
    return code.trim().toUpperCase();
  }

  /**
   * Validacao publica usada pelo checkout antes de pagar: diz se o cupom vale para o evento
   * e qual o desconto, sem reservar uso. O uso so e contado ao criar o pedido.
   */
  async previewForEvent(slug: string, rawCode: string) {
    const event = await this.prisma.event.findFirst({
      where: { slug, status: EventStatus.PUBLISHED },
      select: { id: true, tenantId: true }
    });
    if (!event) {
      throw new NotFoundException("Evento nao encontrado.");
    }
    const coupon = await this.validateAndApply(rawCode, event.tenantId, event.id);
    return {
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      discountFixedCents: coupon.discountFixedCents
    };
  }

  async validateAndApply(rawCode: string, tenantId: string, eventId: string) {
    const code = CouponsService.normalizeCode(rawCode);
    const coupon = code
      ? await this.prisma.coupon.findUnique({ where: { code }, include: { events: true } })
      : null;
    if (!coupon || !coupon.isActive) {
      throw new NotFoundException("Cupom invalido ou inativo.");
    }
    if (coupon.tenantId && coupon.tenantId !== tenantId) {
      throw new NotFoundException("Cupom invalido para este evento.");
    }
    if (!CouponsService.appliesToEvent(coupon, eventId)) {
      throw new NotFoundException("Cupom invalido para este evento.");
    }

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      throw new BadRequestException("Cupom fora da data de validade.");
    }
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException("Cupom esgotado.");
    }
    
    return coupon;
  }

  /**
   * Sem nenhum evento vinculado, o cupom vale para todos os eventos do
   * tenant (comportamento anterior). Com eventos vinculados, so vale para
   * eles. Usado tanto aqui quanto no checkout (fora de uma transacao) e
   * repetido, propositalmente simples, dentro da transacao de checkout.
   */
  static appliesToEvent(coupon: { events?: { eventId: string }[] }, eventId: string) {
    const restrictedTo = coupon.events ?? [];
    return restrictedTo.length === 0 || restrictedTo.some((link) => link.eventId === eventId);
  }

  calculateDiscount(subtotalCents: number, coupon: { discountPercent: number; discountFixedCents: number }) {
    const percentDiscount = Math.round(subtotalCents * ((coupon.discountPercent ?? 0) / 100));
    const fixedDiscount = coupon.discountFixedCents ?? 0;
    return Math.min(subtotalCents, percentDiscount + fixedDiscount);
  }

  private validateDiscount(discountPercent?: number, discountFixedCents?: number, required = false) {
    const hasDiscountPatch = discountPercent !== undefined || discountFixedCents !== undefined;
    if ((required || hasDiscountPatch) && (discountPercent ?? 0) <= 0 && (discountFixedCents ?? 0) <= 0) {
      throw new BadRequestException("Informe desconto percentual ou valor fixo.");
    }
  }
}
