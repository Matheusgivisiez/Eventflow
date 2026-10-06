import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CouponsService } from "./coupons.service";

const baseCoupon = {
  id: "c1",
  code: "PROMO10",
  tenantId: "t1",
  ownerId: "owner-1",
  isActive: true,
  discountPercent: 10,
  discountFixedCents: 0,
  maxUses: 5,
  usedCount: 0,
  validFrom: new Date(Date.now() - 60_000),
  validUntil: new Date(Date.now() + 60_000)
};

function makeService(
  coupon: (Partial<typeof baseCoupon> & { events?: { eventId: string }[] }) | null = baseCoupon,
  event: { id: string; tenantId: string; ownerId: string } | null = { id: "e1", tenantId: "t1", ownerId: "owner-1" }
) {
  const prisma = {
    coupon: {
      findUnique: jest.fn().mockResolvedValue(coupon ? { events: [], ...baseCoupon, ...coupon } : null)
    },
    event: { findFirst: jest.fn().mockResolvedValue(event) }
  };
  return { service: new CouponsService(prisma as never), prisma };
}

describe("CouponsService", () => {
  it("normaliza o código digitado (espaços e minúsculas)", () => {
    expect(CouponsService.normalizeCode("  promo10 ")).toBe("PROMO10");
  });

  it("aceita cupom digitado em minúsculas no preview", async () => {
    const { service, prisma } = makeService();
    await expect(service.previewForEvent("festa", " promo10")).resolves.toEqual({ code: "PROMO10", discountPercent: 10, discountFixedCents: 0 });
    expect(prisma.coupon.findUnique).toHaveBeenCalledWith({ where: { code: "PROMO10" }, include: { events: true } });
  });

  it("recusa cupom de outro organizador", async () => {
    const { service } = makeService({ tenantId: "outro" });
    await expect(service.previewForEvent("festa", "PROMO10")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("recusa cupom de outro criador dentro da mesma organização", async () => {
    const { service } = makeService({ ownerId: "owner-2" });
    await expect(service.previewForEvent("festa", "PROMO10")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("não deixa o organizador vincular cupom a evento de outro criador", async () => {
    const prisma = {
      coupon: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      event: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new CouponsService(prisma as never);
    await expect(service.create("t1", "owner-1", {
      code: "NOVO10", discountPercent: 10, maxUses: 0,
      validFrom: new Date(Date.now() - 1000).toISOString(),
      validUntil: new Date(Date.now() + 60_000).toISOString(),
      eventIds: ["event-of-owner-2"]
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.findMany).toHaveBeenCalledWith({ where: { id: { in: ["event-of-owner-2"] }, tenantId: "t1", ownerId: "owner-1" }, select: { id: true } });
    expect(prisma.coupon.create).not.toHaveBeenCalled();
  });

  it("recusa cupom esgotado", async () => {
    const { service } = makeService({ maxUses: 2, usedCount: 2 });
    await expect(service.previewForEvent("festa", "PROMO10")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("recusa cupom vencido", async () => {
    const { service } = makeService({ validUntil: new Date(Date.now() - 1000) });
    await expect(service.previewForEvent("festa", "PROMO10")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("só enxerga evento privado quando o token do convite confere", async () => {
    const { service, prisma } = makeService();

    await service.previewForEvent("festa", "PROMO10");
    expect(prisma.event.findFirst.mock.calls[0][0].where.OR).toEqual([{ isPrivate: false }]);

    await service.previewForEvent("festa", "PROMO10", "convite");
    expect(prisma.event.findFirst.mock.calls[1][0].where.OR).toEqual([
      { isPrivate: false },
      { isPrivate: true, inviteTokenHash: expect.stringMatching(/^[0-9a-f]{64}$/) }
    ]);
  });

  it("recusa evento inexistente", async () => {
    const { service } = makeService(baseCoupon, null);
    await expect(service.previewForEvent("nada", "PROMO10")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("aceita cupom restrito ao evento em questão", async () => {
    const { service } = makeService({ events: [{ eventId: "e1" }] });
    await expect(service.previewForEvent("festa", "PROMO10")).resolves.toMatchObject({ code: "PROMO10" });
  });

  it("recusa cupom restrito a outro evento", async () => {
    const { service } = makeService({ events: [{ eventId: "outro-evento" }] });
    await expect(service.previewForEvent("festa", "PROMO10")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("appliesToEvent: sem eventos vinculados vale pra qualquer evento do tenant", () => {
    expect(CouponsService.appliesToEvent({ events: [] }, "qualquer")).toBe(true);
  });

  it("appliesToEvent: com eventos vinculados so vale pra eles", () => {
    expect(CouponsService.appliesToEvent({ events: [{ eventId: "e1" }] }, "e2")).toBe(false);
    expect(CouponsService.appliesToEvent({ events: [{ eventId: "e1" }] }, "e1")).toBe(true);
  });
});
