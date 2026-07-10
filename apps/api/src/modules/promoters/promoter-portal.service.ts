import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PromoterWithdrawalStatus } from "@prisma/client";

@Injectable()
export class PromoterPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const promoter = await this.prisma.promoter.findUnique({ where: { userId } });
    if (!promoter) throw new NotFoundException("Promoter profile not found.");

    const links = await this.prisma.promoterLink.findMany({
      where: { promoterId: promoter.id },
      include: { event: { select: { title: true, bannerUrl: true, startsAt: true } } }
    });

    const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
    const totalConversions = links.reduce((sum, link) => sum + link.conversions, 0);
    const totalRevenue = links.reduce((sum, link) => sum + link.revenueCents, 0);
    const totalCommissions = links.reduce((sum, link) => sum + link.commissionAcumCents, 0);

    const withdrawals = await this.prisma.promoterWithdrawal.findMany({
      where: { promoterId: promoter.id, status: { in: [PromoterWithdrawalStatus.PAID, PromoterWithdrawalStatus.APPROVED] } }
    });
    const withdrawnAmount = withdrawals.reduce((sum, w) => sum + w.amountCents, 0);
    const availableBalance = totalCommissions - withdrawnAmount;

    return {
      promoter,
      links,
      stats: {
        totalClicks,
        totalConversions,
        totalRevenueCents: totalRevenue,
        totalCommissionsCents: totalCommissions,
        availableBalanceCents: availableBalance,
        withdrawnCents: withdrawnAmount
      }
    };
  }

  async getSales(userId: string) {
    const promoter = await this.prisma.promoter.findUnique({ where: { userId } });
    if (!promoter) throw new NotFoundException("Promoter profile not found.");

    const links = await this.prisma.promoterLink.findMany({ where: { promoterId: promoter.id } });
    const linkIds = links.map(l => l.id);

    return this.prisma.order.findMany({
      where: { promoterLinkId: { in: linkIds }, status: "PAID" },
      include: { event: { select: { title: true } }, promoterLink: { select: { code: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async requestWithdrawal(userId: string, amountCents: number) {
    const promoter = await this.prisma.promoter.findUnique({ where: { userId } });
    if (!promoter) throw new NotFoundException("Promoter profile not found.");

    if (!promoter.pixKey) throw new BadRequestException("PIX key is required to request a withdrawal.");

    const dashboard = await this.getDashboard(userId);
    if (amountCents > dashboard.stats.availableBalanceCents) {
      throw new BadRequestException("Insufficient balance.");
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
    if (!promoter) throw new NotFoundException("Promoter profile not found.");

    return this.prisma.promoterWithdrawal.findMany({
      where: { promoterId: promoter.id },
      orderBy: { requestedAt: "desc" }
    });
  }
}
