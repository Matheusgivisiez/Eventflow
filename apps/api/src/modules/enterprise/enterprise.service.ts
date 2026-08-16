import { Injectable } from "@nestjs/common";
import { RequestUser } from "../../common/types/request-user";
import { EnterpriseAffiliatesService } from "./services/enterprise-affiliates.service";
import { EnterpriseAiService } from "./services/enterprise-ai.service";
import { EnterpriseAnalyticsService } from "./services/enterprise-analytics.service";
import { AnyRecord } from "./services/enterprise-domain.service";
import { EnterpriseCrmService } from "./services/enterprise-crm.service";
import { EnterpriseInfrastructureService } from "./services/enterprise-infrastructure.service";
import { EnterpriseMarketplaceService } from "./services/enterprise-marketplace.service";
import { EnterpriseMarketingService } from "./services/enterprise-marketing.service";
import { EnterpriseMobileService } from "./services/enterprise-mobile.service";
import { EnterpriseOverviewService } from "./services/enterprise-overview.service";
import { EnterprisePublicApiService } from "./services/enterprise-public-api.service";
import { EnterpriseSeatMapsService } from "./services/enterprise-seat-maps.service";
import { EnterpriseSecurityService } from "./services/enterprise-security.service";
import { EnterpriseWhiteLabelService } from "./services/enterprise-white-label.service";

@Injectable()
export class EnterpriseService {
  constructor(
    private readonly overviewDomain: EnterpriseOverviewService,
    private readonly whiteLabelDomain: EnterpriseWhiteLabelService,
    private readonly mobileDomain: EnterpriseMobileService,
    private readonly affiliatesDomain: EnterpriseAffiliatesService,
    private readonly crmDomain: EnterpriseCrmService,
    private readonly marketingDomain: EnterpriseMarketingService,
    private readonly analyticsDomain: EnterpriseAnalyticsService,
    private readonly publicApiDomain: EnterprisePublicApiService,
    private readonly seatMapsDomain: EnterpriseSeatMapsService,
    private readonly marketplaceDomain: EnterpriseMarketplaceService,
    private readonly aiDomain: EnterpriseAiService,
    private readonly securityDomain: EnterpriseSecurityService,
    private readonly infrastructureDomain: EnterpriseInfrastructureService
  ) {}

  overview(user: RequestUser) {
    return this.overviewDomain.overview(user);
  }

  getWhiteLabel(user: RequestUser) {
    return this.whiteLabelDomain.getWhiteLabel(user);
  }

  upsertWhiteLabel(user: RequestUser, body: AnyRecord) {
    return this.whiteLabelDomain.upsertWhiteLabel(user, body);
  }

  resolveWhiteLabelDomain(domain?: string) {
    return this.whiteLabelDomain.resolveWhiteLabelDomain(domain);
  }

  registerMobileDevice(user: RequestUser, body: AnyRecord) {
    return this.mobileDomain.registerMobileDevice(user, body);
  }

  syncOfflineCheckins(user: RequestUser, body: AnyRecord) {
    return this.mobileDomain.syncOfflineCheckins(user, body);
  }

  affiliateDashboard(user: RequestUser) {
    return this.affiliatesDomain.affiliateDashboard(user);
  }

  upsertAffiliateProgram(user: RequestUser, body: AnyRecord) {
    return this.affiliatesDomain.upsertAffiliateProgram(user, body);
  }

  createAffiliateLink(user: RequestUser, body: AnyRecord) {
    return this.affiliatesDomain.createAffiliateLink(user, body);
  }

  crmCustomers(user: RequestUser, query: Record<string, string>) {
    return this.crmDomain.crmCustomers(user, query);
  }

  createCrmCustomer(user: RequestUser, body: AnyRecord) {
    return this.crmDomain.createCrmCustomer(user, body);
  }

  createSegment(user: RequestUser, body: AnyRecord) {
    return this.crmDomain.createSegment(user, body);
  }

  createCampaign(user: RequestUser, body: AnyRecord) {
    return this.marketingDomain.createCampaign(user, body);
  }

  createAutomation(user: RequestUser, body: AnyRecord) {
    return this.marketingDomain.createAutomation(user, body);
  }

  marketingDashboard(user: RequestUser) {
    return this.marketingDomain.marketingDashboard(user);
  }

  queueMarketingMessage(user: RequestUser, body: AnyRecord) {
    return this.marketingDomain.queueMarketingMessage(user, body);
  }

  analyticsDashboard(user: RequestUser, query: Record<string, string>) {
    return this.analyticsDomain.analyticsDashboard(user, query);
  }

  trackAnalytics(body: AnyRecord) {
    return this.analyticsDomain.trackAnalytics(body);
  }

  upsertAnalyticsIntegration(user: RequestUser, body: AnyRecord) {
    return this.analyticsDomain.upsertAnalyticsIntegration(user, body);
  }

  createApiClient(user: RequestUser, body: AnyRecord) {
    return this.publicApiDomain.createApiClient(user, body);
  }

  createApiKey(user: RequestUser, body: AnyRecord) {
    return this.publicApiDomain.createApiKey(user, body);
  }

  publicApiDocs() {
    return this.publicApiDomain.publicApiDocs();
  }

  seatMaps(user: RequestUser, eventId: string) {
    return this.seatMapsDomain.seatMaps(user, eventId);
  }

  createSeatMap(user: RequestUser, eventId: string, body: AnyRecord) {
    return this.seatMapsDomain.createSeatMap(user, eventId, body);
  }

  holdSeats(user: RequestUser, eventId: string, body: AnyRecord) {
    return this.seatMapsDomain.holdSeats(user, eventId, body);
  }

  reserveSeats(user: RequestUser, eventId: string, body: AnyRecord) {
    return this.seatMapsDomain.reserveSeats(user, eventId, body);
  }

  marketplaceSearch(query: Record<string, string>) {
    return this.marketplaceDomain.marketplaceSearch(query);
  }

  marketplaceCategories() {
    return this.marketplaceDomain.marketplaceCategories();
  }

  upsertMarketplaceProfile(user: RequestUser, body: AnyRecord) {
    return this.marketplaceDomain.upsertMarketplaceProfile(user, body);
  }

  reviewEvent(user: RequestUser, body: AnyRecord) {
    return this.marketplaceDomain.reviewEvent(user, body);
  }

  favoriteEvent(user: RequestUser, body: AnyRecord) {
    return this.marketplaceDomain.favoriteEvent(user, body);
  }

  aiDashboard(user: RequestUser) {
    return this.aiDomain.aiDashboard(user);
  }

  createForecast(user: RequestUser, body: AnyRecord) {
    return this.aiDomain.createForecast(user, body);
  }

  executiveDashboard(user: RequestUser) {
    return this.aiDomain.executiveDashboard(user);
  }

  securityDashboard(user: RequestUser) {
    return this.securityDomain.securityDashboard(user);
  }

  enableTwoFactor(user: RequestUser) {
    return this.securityDomain.enableTwoFactor(user);
  }

  scheduleBackup(user: RequestUser, body: AnyRecord) {
    return this.securityDomain.scheduleBackup(user, body);
  }

  infrastructureBlueprint() {
    return this.infrastructureDomain.infrastructureBlueprint();
  }
}
