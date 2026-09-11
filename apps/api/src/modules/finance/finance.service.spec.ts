import { WithdrawalStatus } from "@prisma/client";
import { FinanceService } from "./finance.service";

function createService() {
  const prisma = {
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
