import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PaymentStatus, PromoterWithdrawalStatus } from "@prisma/client";
import { PromoterPortalService } from "../promoter-portal.service";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    promoter: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    promoterLink: {
      findMany: jest.fn(),
    },
    promoterWithdrawal: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
  };
}

// ─── PromoterPortalService Tests ─────────────────────────────────────────────

describe("PromoterPortalService", () => {
  let service: PromoterPortalService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new PromoterPortalService(prisma as any);
    jest.clearAllMocks();
  });

  // ── getDashboard ─────────────────────────────────────────────────────────

  describe("getDashboard", () => {
    it("throws NotFoundException if promoter profile not found", async () => {
      prisma.promoter.findUnique.mockResolvedValue(null);

      await expect(service.getDashboard("user-missing")).rejects.toThrow(NotFoundException);
    });

    it("calculates commission from PAID orders only — not from PENDING", async () => {
      prisma.promoter.findUnique.mockResolvedValue({ id: "p-1" });
      prisma.promoterLink.findMany.mockResolvedValue([
        { id: "link-1", clicks: 10, event: { title: "Evento A" } }
      ]);

      // 1 PAID order with R$100 commission
      prisma.order.findMany
        .mockResolvedValueOnce([
          { promoterLinkId: "link-1", promoterCommissionCents: 10000, totalCents: 100000 }
        ])
        // 1 PENDING order with R$50 commission — should NOT affect available balance
        .mockResolvedValueOnce([
          { promoterLinkId: "link-1", promoterCommissionCents: 5000 }
        ]);

      prisma.promoterWithdrawal.findMany.mockResolvedValue([
        { amountCents: 2000 } // R$20 already withdrawn
      ]);

      const result = await service.getDashboard("user-1");

      expect(result.stats.totalCommissionsCents).toBe(10000); // Only PAID
      expect(result.stats.pendingCommissionsCents).toBe(5000); // Informational only
      expect(result.stats.availableBalanceCents).toBe(8000);  // 10000 - 2000 withdrawn
    });

    it("returns zero balance when all commissions have been withdrawn", async () => {
      prisma.promoter.findUnique.mockResolvedValue({ id: "p-1" });
      prisma.promoterLink.findMany.mockResolvedValue([{ id: "link-1", clicks: 5 }]);
      prisma.order.findMany
        .mockResolvedValueOnce([{ promoterLinkId: "link-1", promoterCommissionCents: 5000, totalCents: 50000 }])
        .mockResolvedValueOnce([]);
      prisma.promoterWithdrawal.findMany.mockResolvedValue([
        { amountCents: 5000 }
      ]);

      const result = await service.getDashboard("user-1");

      expect(result.stats.availableBalanceCents).toBe(0);
    });
  });

  // ── requestWithdrawal ────────────────────────────────────────────────────

  describe("requestWithdrawal", () => {
    it("throws BadRequestException if amount is zero or negative", async () => {
      await expect(service.requestWithdrawal("user-1", 0)).rejects.toThrow(BadRequestException);
      await expect(service.requestWithdrawal("user-1", -100)).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException if promoter has no PIX key", async () => {
      prisma.promoter.findUnique.mockResolvedValue({ id: "p-1", pixKey: null });

      await expect(service.requestWithdrawal("user-1", 5000)).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException if withdrawal amount exceeds available balance", async () => {
      prisma.promoter.findUnique.mockResolvedValue({ id: "p-1", pixKey: "joao@pix.com" });
      prisma.promoterLink.findMany.mockResolvedValue([{ id: "link-1", clicks: 0 }]);
      prisma.order.findMany
        .mockResolvedValueOnce([{ promoterLinkId: "link-1", promoterCommissionCents: 1000, totalCents: 10000 }])
        .mockResolvedValueOnce([]);
      prisma.promoterWithdrawal.findMany.mockResolvedValue([]);

      await expect(service.requestWithdrawal("user-1", 5000)).rejects.toThrow(BadRequestException);
    });

    it("creates withdrawal when amount is within available balance", async () => {
      prisma.promoter.findUnique.mockResolvedValue({ id: "p-1", pixKey: "joao@pix.com" });
      prisma.promoterLink.findMany.mockResolvedValue([{ id: "link-1", clicks: 0 }]);
      prisma.order.findMany
        .mockResolvedValueOnce([{ promoterLinkId: "link-1", promoterCommissionCents: 10000, totalCents: 100000 }])
        .mockResolvedValueOnce([]);
      prisma.promoterWithdrawal.findMany
        .mockResolvedValueOnce([]) // For balance calc
        .mockResolvedValueOnce([]); // For withdrawal query
      prisma.promoterWithdrawal.create.mockResolvedValue({
        id: "w-1",
        amountCents: 5000,
        status: PromoterWithdrawalStatus.PENDING
      });

      const result = await service.requestWithdrawal("user-1", 5000);

      expect(result.status).toBe(PromoterWithdrawalStatus.PENDING);
      expect(prisma.promoterWithdrawal.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amountCents: 5000 }) })
      );
    });
  });
});
