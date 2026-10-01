import { PaymentStatus } from "@prisma/client";
import { PaymentsService } from "./payments.service";

jest.mock("qrcode", () => ({ toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,qr") }));

function setup(overrides: { paidAt?: Date | null; stockAvailable?: boolean } = {}) {
  const expiredPayment = {
    id: "payment-1",
    orderId: "order-1",
    status: PaymentStatus.CANCELED,
    paidAt: overrides.paidAt ?? null,
    provider: "infinite_pay",
    providerRef: "nsu-1",
    checkoutId: "slug-1",
    transactionId: "nsu-1",
    amountCents: 11000,
    event: { id: "event-1", tenantId: "tenant-1" }
  };
  const order = {
    id: "order-1",
    status: PaymentStatus.CANCELED,
    stockReservedAt: null,
    couponId: "coupon-1",
    items: [{ ticketTypeId: "lot-1", quantity: 2, ticketType: { id: "lot-1", name: "1º Lote", quantity: 130, sold: 128 } }]
  };
  const prisma: any = {
    payment: {
      findFirst: jest.fn()
        .mockResolvedValueOnce(expiredPayment)
        .mockResolvedValueOnce({ ...expiredPayment, order }),
      findUnique: jest.fn().mockResolvedValue(expiredPayment),
      update: jest.fn().mockResolvedValue({})
    },
    order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    ticketType: { updateMany: jest.fn().mockResolvedValue({ count: overrides.stockAvailable === false ? 0 : 1 }) },
    coupon: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn((callback: any) => callback(prisma))
  };
  const infinitePay = {
    verifyPayment: jest.fn().mockResolvedValue({ status: "PAID", amountCents: 11000, paidAmountCents: 11000, providerRef: "nsu-1" })
  };
  const config = { get: jest.fn((key: string) => (key === "QR_CODE_SECRET" ? "test-secret" : undefined)) };
  const service = new PaymentsService(prisma, {} as any, config as any, {} as any, undefined, infinitePay as any);
  const updateStatus = jest.spyOn(service, "updateStatus").mockResolvedValue({ status: PaymentStatus.PAID } as any);
  return { service, prisma, updateStatus };
}

describe("PaymentsService - pagamento depois do prazo da reserva", () => {
  it("reativa o pedido vencido, reserva o estoque de novo e segue para PAID", async () => {
    const { service, prisma, updateStatus } = setup();

    const result = await service.reconcileProviderStatus("payment-1", "tenant-1");

    expect(prisma.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "order-1", status: PaymentStatus.CANCELED, stockReservedAt: null },
      data: expect.objectContaining({ status: PaymentStatus.PENDING })
    }));
    expect(prisma.ticketType.updateMany).toHaveBeenCalledWith({
      where: { id: "lot-1", sold: { lte: 128 } },
      data: { sold: { increment: 2 } }
    });
    expect(prisma.coupon.updateMany).toHaveBeenCalled();
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: { status: PaymentStatus.PENDING, canceledAt: null }
    });
    expect(updateStatus).toHaveBeenCalledWith("payment-1", "tenant-1", expect.objectContaining({ status: PaymentStatus.PAID }));
    expect(result).toEqual({ status: PaymentStatus.PAID });
  });

  it("não emite ingresso quando o lote esgotou e deixa o caso registrado", async () => {
    const { service, prisma, updateStatus } = setup({ stockAvailable: false });
    const logError = jest.spyOn((service as any).logger, "error").mockImplementation(() => undefined);

    const result = await service.reconcileProviderStatus("payment-1", "tenant-1");

    expect(updateStatus).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(result?.status).toBe(PaymentStatus.CANCELED);
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("PAGO SEM ESTOQUE"));
  });

  it("não reativa um pagamento que já tinha sido pago e depois cancelado", async () => {
    const { service, prisma } = setup({ paidAt: new Date() });

    await service.reconcileProviderStatus("payment-1", "tenant-1");

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });
});
