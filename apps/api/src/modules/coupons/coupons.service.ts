import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { UpdateCouponDto } from "./dto/update-coupon.dto";

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string | null, dto: CreateCouponDto) {
    this.validateDiscount(dto.discountPercent, dto.discountFixedCents, true);
    const exists = await this.prisma.coupon.findUnique({ where: { code: dto.code } });
    if (exists) {
      throw new BadRequestException("Cupom com este codigo ja existe.");
    }
    if (new Date(dto.validUntil) <= new Date(dto.validFrom)) {
      throw new BadRequestException("Data de validade deve ser posterior ao inicio.");
    }
    
    return this.prisma.coupon.create({
      data: {
        ...dto,
        code: dto.code.toUpperCase(),
        tenantId,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil)
      }
    });
  }

  list(tenantId: string | null) {
    return this.prisma.coupon.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
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

    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...dto,
        code: dto.code?.toUpperCase(),
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined
      }
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

  async validateAndApply(code: string, tenantId: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.isActive) {
      throw new NotFoundException("Cupom invalido ou inativo.");
    }
    if (coupon.tenantId && coupon.tenantId !== tenantId) {
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
