import { WithdrawalStatus } from "@prisma/client";
import { FinanceService } from "./finance.service";

function createService() {
  const prisma = {
    order: { aggregate: jest.fn(), findMany: jest.fn() },
    withdrawal: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  };
  const abacatePay = {
    createPixTransfer: jest.fn().mockResolvedValue({ id: "transfer-1" })
  };
  const service = new FinanceService(prisma as any, abacatePay as any);
  return { service, prisma, abacatePay };
}

describe("FinanceService", () => {
  it("mostra somente a receita dos eventos atribuídos ao colaborador", async () => {
    const { service, prisma } = createService();
    prisma.order.aggregate.mockResolvedValue({ _sum: { totalCents: 12000, feeCents: 1000 } });
    prisma.order.findMany.mockResolvedValue([{ id: "order-1", totalCents: 12000, feeCents: 1000, createdAt: new Date(), event: { title: "Evento A" } }]);
    const result = await service.teamSummary(["event-a"]);
    expect(prisma.order.aggregate).toHaveBeenCalledWith({ where: { eventId: { in: ["event-a"] }, status: "PAID" }, _sum: { totalCents: true, feeCents: true } });
    expect(result).toMatchObject({ balanceCents: 11000, totalFeesCents: 1000, readOnly: true });
    expect(result.statement[0]).toMatchObject({ id: "order-1", amountCents: 11000 });
  });
  it("marks instant Pix withdrawals as PAID when paidAt is set", async () => {
    const { service, prisma } = createService();
    prisma.withdrawal.findUnique.mockResolvedValue({
      id: "withdrawal-1",
      amountCents: 5000,
      status: WithdrawalStatus.REQUESTED
    });
    prisma.withdrawal.update.mockResolvedValue({
      id: "withdrawal-1",
      status: WithdrawalStatus.PAID
    });

    await service.approveWithdrawal("withdrawal-1", { pixKey: "cliente@example.com" });

    expect(prisma.withdrawal.update).toHaveBeenCalledWith({
      where: { id: "withdrawal-1" },
      data: {
        status: WithdrawalStatus.PAID,
        pixKey: "cliente@example.com",
        paidAt: expect.any(Date)
      }
    });
  });
});
