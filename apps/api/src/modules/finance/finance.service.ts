import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RequestWithdrawalDto } from "./dto/request-withdrawal.dto";

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string) {
    const [credits, withdrawals, entries] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({ where: { tenantId }, _sum: { amountCents: true, feeCents: true } }),
      this.prisma.withdrawal.aggregate({ where: { tenantId }, _sum: { amountCents: true } }),
      this.prisma.ledgerEntry.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);
    const balanceCents = (credits._sum.amountCents ?? 0) - (withdrawals._sum.amountCents ?? 0);
    return {
      balanceCents,
      totalFeesCents: credits._sum.feeCents ?? 0,
      withdrawnCents: withdrawals._sum.amountCents ?? 0,
      statement: entries
    };
  }

  statement(tenantId: string) {
    return this.prisma.ledgerEntry.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async requestWithdrawal(tenantId: string, dto: RequestWithdrawalDto) {
    const summary = await this.summary(tenantId);
    if (dto.amountCents > summary.balanceCents) {
      throw new BadRequestException("Saldo insuficiente para saque.");
    }
    return this.prisma.withdrawal.create({
      data: { tenantId, amountCents: dto.amountCents }
    });
  }
}
