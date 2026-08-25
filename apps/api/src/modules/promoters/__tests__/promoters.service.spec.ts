import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PromoterStatus } from "@prisma/client";
import { PromotersService } from "../promoters.service";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePrisma(overrides: Partial<any> = {}) {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    promoter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    promoterLink: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    promoterWithdrawal: { findMany: jest.fn() },
    event: { findFirst: jest.fn() },
    order: { findMany: jest.fn() },
    ...overrides,
  };
}

// ─── PromotersService Tests ──────────────────────────────────────────────────

describe("PromotersService", () => {
  let service: PromotersService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new PromotersService(prisma as any);
    jest.clearAllMocks();
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates a new promoter with PENDING status for a new user", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: "user-1" });
      prisma.promoter.findUnique.mockResolvedValue(null);
      prisma.promoter.create.mockResolvedValue({ id: "p-1", status: PromoterStatus.PENDING });

      const result = await service.create("tenant-1", {
        name: "João",
        email: "joao@test.com",
        password: "password123",
      });

      expect(prisma.promoter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PromoterStatus.PENDING }),
        })
      );
      expect(result.status).toBe(PromoterStatus.PENDING);
    });

    it("throws BadRequestException if password is missing for a new user", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create("tenant-1", { name: "João", email: "joao@test.com" })
      ).rejects.toThrow(BadRequestException);
    });

    it("throws ConflictException if user is already a promoter on the same tenant", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1", role: "PROMOTER" });
      prisma.promoter.findUnique.mockResolvedValue({ id: "p-1", tenantId: "tenant-1" });

      await expect(
        service.create("tenant-1", { name: "João", email: "joao@test.com" })
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── updateStatus ─────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("updates promoter status successfully", async () => {
      prisma.promoter.findFirst.mockResolvedValue({ id: "p-1", tenantId: "tenant-1" });
      prisma.promoter.update.mockResolvedValue({ id: "p-1", status: PromoterStatus.ACTIVE });

      const result = await service.updateStatus("tenant-1", "p-1", PromoterStatus.ACTIVE);

      expect(result.status).toBe(PromoterStatus.ACTIVE);
    });

    it("throws NotFoundException for promoter from different tenant", async () => {
      prisma.promoter.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus("tenant-1", "p-other", PromoterStatus.ACTIVE)
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── addPromoterToEvent ───────────────────────────────────────────────────

  describe("addPromoterToEvent", () => {
    it("throws NotFoundException if event does not belong to tenant", async () => {
      prisma.event.findFirst.mockResolvedValue(null);

      await expect(
        service.addPromoterToEvent("tenant-1", "event-x", { promoterId: "p-1", commissionType: "PERCENTAGE", commissionValue: 1000 })
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException if promoter is not ACTIVE", async () => {
      prisma.event.findFirst.mockResolvedValue({ id: "event-1", slug: "ev" });
      prisma.promoter.findFirst.mockResolvedValue({ id: "p-1", status: PromoterStatus.PENDING });

      await expect(
        service.addPromoterToEvent("tenant-1", "event-1", { promoterId: "p-1", commissionType: "PERCENTAGE", commissionValue: 1000 })
      ).rejects.toThrow(BadRequestException);
    });

    it("throws ConflictException if promoter is already linked to the event", async () => {
      prisma.event.findFirst.mockResolvedValue({ id: "event-1", slug: "ev" });
      prisma.promoter.findFirst.mockResolvedValue({ id: "p-1", status: PromoterStatus.ACTIVE });
      prisma.promoterLink.findFirst.mockResolvedValue({ id: "link-1" });

      await expect(
        service.addPromoterToEvent("tenant-1", "event-1", { promoterId: "p-1", commissionType: "PERCENTAGE", commissionValue: 1000 })
      ).rejects.toThrow(ConflictException);
    });

    it("creates a link with a unique code when no conflict exists", async () => {
      prisma.event.findFirst.mockResolvedValue({ id: "event-1", slug: "test-event" });
      prisma.promoter.findFirst.mockResolvedValue({ id: "p-1", status: PromoterStatus.ACTIVE });
      prisma.promoterLink.findFirst.mockResolvedValue(null); // no existing link
      prisma.promoterLink.create.mockResolvedValue({ id: "link-1", code: "test-eve-abc123" });

      const result = await service.addPromoterToEvent("tenant-1", "event-1", {
        promoterId: "p-1",
        commissionType: "PERCENTAGE",
        commissionValue: 1000
      });

      expect(prisma.promoterLink.create).toHaveBeenCalled();
      expect(result.id).toBe("link-1");
    });
  });

  // ── removePromoterFromEvent ──────────────────────────────────────────────

  describe("removePromoterFromEvent", () => {
    it("removes link when it belongs to the correct event and tenant", async () => {
      prisma.promoterLink.findFirst.mockResolvedValue({ id: "link-1" });
      prisma.promoterLink.delete.mockResolvedValue({ id: "link-1" });

      const result = await service.removePromoterFromEvent("tenant-1", "event-1", "link-1");

      expect(result.success).toBe(true);
    });

    it("throws NotFoundException when link not found for this tenant", async () => {
      prisma.promoterLink.findFirst.mockResolvedValue(null);

      await expect(
        service.removePromoterFromEvent("tenant-1", "event-1", "link-other")
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── trackClick ──────────────────────────────────────────────────────────

  describe("trackClick", () => {
    it("returns event slug and increments click counter", async () => {
      prisma.promoterLink.findFirst.mockResolvedValue({
        id: "link-1",
        event: { slug: "my-event" }
      });
      prisma.promoterLink.update.mockResolvedValue({});

      const result = await service.trackClick("test-code");

      expect(result.eventSlug).toBe("my-event");
    });

    it("throws NotFoundException for invalid or inactive codes", async () => {
      prisma.promoterLink.findFirst.mockResolvedValue(null);

      await expect(service.trackClick("invalid-code")).rejects.toThrow(NotFoundException);
    });
  });
});
