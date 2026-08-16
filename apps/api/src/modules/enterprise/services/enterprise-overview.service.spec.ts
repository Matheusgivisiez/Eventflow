import { UserRole } from "@prisma/client";
import { EnterpriseOverviewService } from "./enterprise-overview.service";

function counter(value = 0) {
  return { count: jest.fn().mockResolvedValue(value) };
}

function createPrisma(overrides: Record<string, unknown> = {}) {
  return {
    event: counter(0),
    crmCustomer: counter(0),
    crmSegment: counter(0),
    affiliateProgram: { findUnique: jest.fn().mockResolvedValue(null) },
    affiliateLink: counter(0),
    crmCampaign: counter(0),
    crmAutomation: counter(0),
    marketingMessage: counter(0),
    publicApiClient: counter(0),
    apiKey: counter(0),
    seatMap: counter(0),
    analyticsIntegration: counter(0),
    analyticsEvent: counter(0),
    fraudSignal: counter(0),
    whiteLabelSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    mobileDevice: counter(0),
    offlineCheckinBatch: counter(0),
    marketplaceProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    aiForecast: counter(0),
    aiInsight: counter(0),
    permissionPolicy: counter(0),
    backupJob: counter(0),
    encryptionKeyRecord: counter(0),
    ...overrides
  };
}

describe("EnterpriseOverviewService readiness", () => {
  const user = { id: "user-1", tenantId: "tenant-1", email: "organizer@example.com", role: UserRole.ORGANIZER };

  it("does not mark tenant modules as production ready without real setup data", async () => {
    const service = new EnterpriseOverviewService(createPrisma() as any);

    const result = await service.overview(user);

    expect(result.readiness.whiteLabel.status).toBe("not_started");
    expect(result.readiness.crm.status).toBe("not_started");
    expect(result.readiness.publicApi.status).toBe("not_started");
    expect(result.readiness.infrastructure.status).toBe("prototype");
    expect(Object.values(result.readiness).some((entry) => entry.status === "production_ready")).toBe(false);
  });

  it("uses tenant records as objective evidence for production readiness", async () => {
    const prisma = createPrisma({
      event: counter(2),
      crmCustomer: counter(20),
      crmSegment: counter(3),
      affiliateProgram: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
      affiliateLink: counter(5),
      crmCampaign: counter(4),
      crmAutomation: counter(2),
      marketingMessage: counter(10),
      publicApiClient: counter(1),
      apiKey: counter(1),
      seatMap: counter(1),
      analyticsIntegration: counter(1),
      analyticsEvent: counter(300),
      whiteLabelSetting: { findUnique: jest.fn().mockResolvedValue({ customDomain: "tickets.example.com", senderEmail: "tickets@example.com" }) },
      mobileDevice: counter(2),
      offlineCheckinBatch: counter(8),
      marketplaceProfile: { findUnique: jest.fn().mockResolvedValue({ verification: "APPROVED" }) },
      aiForecast: counter(2),
      aiInsight: counter(1),
      permissionPolicy: counter(2),
      backupJob: counter(1),
      encryptionKeyRecord: counter(1)
    });
    const service = new EnterpriseOverviewService(prisma as any);

    const result = await service.overview(user);

    expect(result.readiness.whiteLabel.status).toBe("production_ready");
    expect(result.readiness.mobileOffline.status).toBe("production_ready");
    expect(result.readiness.affiliates.status).toBe("production_ready");
    expect(result.readiness.crm.status).toBe("production_ready");
    expect(result.readiness.marketingAutomation.status).toBe("production_ready");
    expect(result.readiness.analytics.status).toBe("production_ready");
    expect(result.readiness.publicApi.status).toBe("production_ready");
    expect(result.readiness.seatMaps.status).toBe("production_ready");
    expect(result.readiness.marketplace.status).toBe("production_ready");
    expect(result.readiness.ai.status).toBe("production_ready");
    expect(result.readiness.security.status).toBe("production_ready");
    expect(result.readiness.infrastructure.status).toBe("partial");
    expect(result.counters.analyticsEvents).toBe(300);
  });
});
