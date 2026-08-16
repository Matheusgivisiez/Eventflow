import { UserRole } from "@prisma/client";
import { EnterpriseService } from "./enterprise.service";

function domain(methods: string[]) {
  return Object.fromEntries(methods.map((method) => [method, jest.fn().mockReturnValue(`${method}-result`)]));
}

function createService() {
  const overview = domain(["overview"]);
  const whiteLabel = domain(["getWhiteLabel", "upsertWhiteLabel", "resolveWhiteLabelDomain"]);
  const mobile = domain(["registerMobileDevice", "syncOfflineCheckins"]);
  const affiliates = domain(["affiliateDashboard", "upsertAffiliateProgram", "createAffiliateLink"]);
  const crm = domain(["crmCustomers", "createCrmCustomer", "createSegment"]);
  const marketing = domain(["createCampaign", "createAutomation", "marketingDashboard", "queueMarketingMessage"]);
  const analytics = domain(["analyticsDashboard", "trackAnalytics", "upsertAnalyticsIntegration"]);
  const publicApi = domain(["createApiClient", "createApiKey", "publicApiDocs"]);
  const seatMaps = domain(["seatMaps", "createSeatMap", "holdSeats", "reserveSeats"]);
  const marketplace = domain(["marketplaceSearch", "marketplaceCategories", "upsertMarketplaceProfile", "reviewEvent", "favoriteEvent"]);
  const ai = domain(["aiDashboard", "createForecast", "executiveDashboard"]);
  const security = domain(["securityDashboard", "enableTwoFactor", "scheduleBackup"]);
  const infrastructure = domain(["infrastructureBlueprint"]);

  const service = new EnterpriseService(
    overview as any,
    whiteLabel as any,
    mobile as any,
    affiliates as any,
    crm as any,
    marketing as any,
    analytics as any,
    publicApi as any,
    seatMaps as any,
    marketplace as any,
    ai as any,
    security as any,
    infrastructure as any
  );

  return {
    service,
    domains: {
      overview,
      whiteLabel,
      mobile,
      affiliates,
      crm,
      marketing,
      analytics,
      publicApi,
      seatMaps,
      marketplace,
      ai,
      security,
      infrastructure
    }
  };
}

describe("EnterpriseService facade", () => {
  const user = { id: "user-1", tenantId: "tenant-1", role: UserRole.ORGANIZER };
  const body = { name: "payload" };
  const query = { search: "term" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ["overview", "overview", "overview", [user]],
    ["getWhiteLabel", "whiteLabel", "getWhiteLabel", [user]],
    ["upsertWhiteLabel", "whiteLabel", "upsertWhiteLabel", [user, body]],
    ["resolveWhiteLabelDomain", "whiteLabel", "resolveWhiteLabelDomain", ["example.com"]],
    ["registerMobileDevice", "mobile", "registerMobileDevice", [user, body]],
    ["syncOfflineCheckins", "mobile", "syncOfflineCheckins", [user, body]],
    ["affiliateDashboard", "affiliates", "affiliateDashboard", [user]],
    ["upsertAffiliateProgram", "affiliates", "upsertAffiliateProgram", [user, body]],
    ["createAffiliateLink", "affiliates", "createAffiliateLink", [user, body]],
    ["crmCustomers", "crm", "crmCustomers", [user, query]],
    ["createCrmCustomer", "crm", "createCrmCustomer", [user, body]],
    ["createSegment", "crm", "createSegment", [user, body]],
    ["createCampaign", "marketing", "createCampaign", [user, body]],
    ["createAutomation", "marketing", "createAutomation", [user, body]],
    ["marketingDashboard", "marketing", "marketingDashboard", [user]],
    ["queueMarketingMessage", "marketing", "queueMarketingMessage", [user, body]],
    ["analyticsDashboard", "analytics", "analyticsDashboard", [user, query]],
    ["trackAnalytics", "analytics", "trackAnalytics", [body]],
    ["upsertAnalyticsIntegration", "analytics", "upsertAnalyticsIntegration", [user, body]],
    ["createApiClient", "publicApi", "createApiClient", [user, body]],
    ["createApiKey", "publicApi", "createApiKey", [user, body]],
    ["publicApiDocs", "publicApi", "publicApiDocs", []],
    ["seatMaps", "seatMaps", "seatMaps", [user, "event-1"]],
    ["createSeatMap", "seatMaps", "createSeatMap", [user, "event-1", body]],
    ["holdSeats", "seatMaps", "holdSeats", [user, "event-1", body]],
    ["reserveSeats", "seatMaps", "reserveSeats", [user, "event-1", body]],
    ["marketplaceSearch", "marketplace", "marketplaceSearch", [query]],
    ["marketplaceCategories", "marketplace", "marketplaceCategories", []],
    ["upsertMarketplaceProfile", "marketplace", "upsertMarketplaceProfile", [user, body]],
    ["reviewEvent", "marketplace", "reviewEvent", [user, body]],
    ["favoriteEvent", "marketplace", "favoriteEvent", [user, body]],
    ["aiDashboard", "ai", "aiDashboard", [user]],
    ["createForecast", "ai", "createForecast", [user, body]],
    ["executiveDashboard", "ai", "executiveDashboard", [user]],
    ["securityDashboard", "security", "securityDashboard", [user]],
    ["enableTwoFactor", "security", "enableTwoFactor", [user]],
    ["scheduleBackup", "security", "scheduleBackup", [user, body]],
    ["infrastructureBlueprint", "infrastructure", "infrastructureBlueprint", []]
  ] as Array<[keyof EnterpriseService, keyof ReturnType<typeof createService>["domains"], string, unknown[]]>)(
    "delegates %s to the %s domain",
    (serviceMethod, domainName, domainMethod, args) => {
      const { service, domains } = createService();

      const result = (service[serviceMethod] as (...input: unknown[]) => unknown)(...args);

      expect(domains[domainName][domainMethod]).toHaveBeenCalledWith(...args);
      expect(result).toBe(`${domainMethod}-result`);
    }
  );
});
