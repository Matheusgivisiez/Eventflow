import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { WithdrawalStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AbacatePayGateway } from "../payments/abacate-pay.gateway";
import { ApproveWithdrawalDto } from "./dto/approve-withdrawal.dto";
import { RequestWithdrawalDto } from "./dto/request-withdrawal.dto";

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abacatePay: AbacatePayGateway
  ) {}

  async summary(tenantId: string) {
    const [credits, withdrawals, entries] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({ where: { tenantId }, _sum: { amountCents: true, feeCents: true } }),
      this.prisma.withdrawal.aggregate({ where: { tenantId, status: { in: [WithdrawalStatus.REQUESTED, WithdrawalStatus.APPROVED, WithdrawalStatus.PAID] } }, _sum: { amountCents: true } }),
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
    if (dto.amountCents < 350) {
      throw new BadRequestException("Valor mínimo para saque é R$ 3,50.");
    }
    return this.prisma.withdrawal.create({
      data: { tenantId, amountCents: dto.amountCents, status: WithdrawalStatus.REQUESTED }
    });
  }

  listWithdrawals(tenantId?: string) {
    return this.prisma.withdrawal.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { requestedAt: "desc" },
      take: 100
    });
  }

  async approveWithdrawal(withdrawalId: string, dto: ApproveWithdrawalDto) {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) {
      throw new NotFoundException("Solicitação de saque não encontrada.");
    }
    if (withdrawal.status !== WithdrawalStatus.REQUESTED) {
      throw new BadRequestException(`Saque já está com status "${withdrawal.status}".`);
    }

    // Fire AbacatePay PIX transfer
    const transfer = await this.abacatePay.createPixTransfer({
      pixKey: dto.pixKey,
      amountCents: withdrawal.amountCents,
      description: `Saque Eventflow #${withdrawal.id}`
    });

    // Mark as APPROVED (AbacatePay processes instantly, but we track via providerRef)
    return this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.APPROVED,
        pixKey: dto.pixKey,
        paidAt: new Date()
      }
    });
  }
}

