import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CouponsService } from "./coupons.service";

const baseCoupon = {
  id: "c1",
  code: "PROMO10",
  tenantId: "t1",
  isActive: true,
  discountPercent: 10,
  discountFixedCents: 0,
  maxUses: 5,
  usedCount: 0,
  validFrom: new Date(Date.now() - 60_000),
  validUntil: new Date(Date.now() + 60_000)
};

function makeService(coupon: Partial<typeof baseCoupon> | null = baseCoupon, event: { tenantId: string } | null = { tenantId: "t1" }) {
  const prisma = {
    coupon: { findUnique: jest.fn().mockResolvedValue(coupon ? { ...baseCoupon, ...coupon } : null) },
    event: { findFirst: jest.fn().mockResolvedValue(event) }
  };
  return { service: new CouponsService(prisma as never), prisma };
}

describe("CouponsService", () => {
  it("normaliza o codigo digitado (espacos e minusculas)", () => {
    expect(CouponsService.normalizeCode("  promo10 ")).toBe("PROMO10");
  });

  it("aceita cupom digitado em minusculas no preview", async () => {
    const { service, prisma } = makeService();
    await expect(service.previewForEvent("festa", " promo10")).resolves.toEqual({ code: "PROMO10", discountPercent: 10, discountFixedCents: 0 });
    expect(prisma.coupon.findUnique).toHaveBeenCalledWith({ where: { code: "PROMO10" } });
  });

  it("recusa cupom de outro organizador", async () => {
    const { service } = makeService({ tenantId: "outro" });
    await expect(service.previewForEvent("festa", "PROMO10")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("recusa cupom esgotado", async () => {
    const { service } = makeService({ maxUses: 2, usedCount: 2 });
    await expect(service.previewForEvent("festa", "PROMO10")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("recusa cupom vencido", async () => {
    const { service } = makeService({ validUntil: new Date(Date.now() - 1000) });
    await expect(service.previewForEvent("festa", "PROMO10")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("recusa evento inexistente", async () => {
    const { service } = makeService(baseCoupon, null);
    await expect(service.previewForEvent("nada", "PROMO10")).rejects.toBeInstanceOf(NotFoundException);
  });
});
