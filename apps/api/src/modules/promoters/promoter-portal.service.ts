import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentStatus, PromoterWithdrawalStatus } from "@prisma/client";

@Injectable()
export class PromoterPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const promoter = await this.prisma.promoter.findUnique({
      where: { userId },
      include: { user: { select: { name: true, email: true, phone: true } } }
    });
    if (!promoter) throw new NotFoundException("Perfil de promoter não encontrado.");
    return promoter;
  }

  async updateProfile(userId: string, data: { pixKey?: string; instagram?: string; city?: string; state?: string }) {
    const promoter = await this.prisma.promoter.findUnique({ where: { userId } });
    if (!promoter) throw new NotFoundException("Perfil de promoter não encontrado.");

    return this.prisma.promoter.update({
      where: { userId },
      data: {
        pixKey: data.pixKey,
        instagram: data.instagram,
        city: data.city,
        state: data.state,
      },
      include: { user: { select: { name: true, email: true, phone: true } } }
    });
  }

  async getDashboard(userId: string) {
    const promoter = await this.prisma.promoter.findUnique({ where: { userId } });
    if (!promoter) throw new NotFoundException("Perfil de promoter não encontrado.");

    const links = await this.prisma.promoterLink.findMany({
      where: { promoterId: promoter.id },
      include: { event: { select: { title: true, bannerUrl: true, startsAt: true, slug: true } } }
    });

    const linkIds = links.map(l => l.id);

    // Only count commissions from PAID orders — critical for financial accuracy
    const paidOrders = await this.prisma.order.findMany({
      where: {
        promoterLinkId: { in: linkIds },
        status: PaymentStatus.PAID
      },
      select: {
        promoterLinkId: true,
        promoterCommissionCents: true,
        totalCents: true,
      }
    });

    // Pending orders (for informational display only — not spendable)
    const pendingOrders = await this.prisma.order.findMany({
      where: {
        promoterLinkId: { in: linkIds },
        status: PaymentStatus.PENDING
      },
      select: {
        promoterLinkId: true,
        promoterCommissionCents: true,
      }
    });

    const withdrawals = await this.prisma.promoterWithdrawal.findMany({
      where: { promoterId: promoter.id, status: { in: [PromoterWithdrawalStatus.PAID, PromoterWithdrawalStatus.APPROVED] } }
    });

    const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
    const totalConversions = paidOrders.length; // Only confirmed sales
    const totalRevenueCents = paidOrders.reduce((sum, o) => sum + o.totalCents, 0);
    const totalCommissionsCents = paidOrders.reduce((sum, o) => sum + o.promoterCommissionCents, 0);
    const pendingCommissionsCents = pendingOrders.reduce((sum, o) => sum + o.promoterCommissionCents, 0);
    const withdrawnAmount = withdrawals.reduce((sum, w) => sum + w.amountCents, 0);
    const availableBalance = totalCommissionsCents - withdrawnAmount;

    return {
      promoter,
      links,
      stats: {
        totalClicks,
        totalConversions,
        totalRevenueCents,
        totalCommissionsCents,  // From PAID orders only
        pendingCommissionsCents, // From PENDING orders — informational only
        availableBalanceCents: Math.max(0, availableBalance),
        withdrawnCents: withdrawnAmount
      }
    };
  }

  async getSales(userId: string) {
    const promoter = await this.prisma.promoter.findUnique({ where: { userId } });
    if (!promoter) throw new NotFoundException("Perfil de promoter não encontrado.");

    const links = await this.prisma.promoterLink.findMany({ where: { promoterId: promoter.id } });
    const linkIds = links.map(l => l.id);

    return this.prisma.order.findMany({
      where: {
        promoterLinkId: { in: linkIds },
        status: PaymentStatus.PAID // Only show confirmed sales
      },
      include: {
        event: { select: { title: true, slug: true } },
        promoterLink: { select: { code: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async requestWithdrawal(userId: string, amountCents: number) {
    if (!amountCents || amountCents <= 0) throw new BadRequestException("Valor de saque inválido.");

    const promoter = await this.prisma.promoter.findUnique({ where: { userId } });
    if (!promoter) throw new NotFoundException("Perfil de promoter não encontrado.");

    if (!promoter.pixKey) throw new BadRequestException("Chave PIX obrigatória para solicitar saque. Cadastre sua chave em Minha Conta.");

    const dashboard = await this.getDashboard(userId);
    if (amountCents > dashboard.stats.availableBalanceCents) {
      throw new BadRequestException(`Saldo insuficiente. Disponível: R$ ${(dashboard.stats.availableBalanceCents / 100).toFixed(2)}`);
    }

    return this.prisma.promoterWithdrawal.create({
      data: {
        promoterId: promoter.id,
        amountCents,
        status: PromoterWithdrawalStatus.PENDING
      }
    });
  }

  async getWithdrawals(userId: string) {
    const promoter = await this.prisma.promoter.findUnique({ where: { userId } });
    if (!promoter) throw new NotFoundException("Perfil de promoter não encontrado.");

    return this.prisma.promoterWithdrawal.findMany({
      where: { promoterId: promoter.id },
      orderBy: { requestedAt: "desc" }
    });
  }
}
