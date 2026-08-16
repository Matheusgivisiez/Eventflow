import { applyDecorators, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { TeamPermission, UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TeamPermissionGuard } from "../../common/guards/team-permission.guard";
import { RequestUser } from "../../common/types/request-user";
import { EnterpriseService } from "./enterprise.service";

const enterpriseRoles = [UserRole.ADMIN, UserRole.ORGANIZER, UserRole.TEAM];
const authenticatedRoles = Object.values(UserRole);

function EnterprisePermission(...permissions: TeamPermission[]) {
  return applyDecorators(
    ApiBearerAuth(),
    Roles(...enterpriseRoles),
    RequirePermissions(...permissions),
    UseGuards(JwtAuthGuard, RolesGuard, TeamPermissionGuard)
  );
}

function EnterpriseRoles(...roles: UserRole[]) {
  return applyDecorators(
    ApiBearerAuth(),
    Roles(...roles),
    UseGuards(JwtAuthGuard, RolesGuard)
  );
}

@ApiTags("Enterprise")
@Controller("enterprise")
export class EnterpriseController {
  constructor(private readonly enterprise: EnterpriseService) {}

  @Get("public-api/docs")
  publicApiDocs() {
    return this.enterprise.publicApiDocs();
  }

  @Post("analytics/track")
  track(@Body() body: Record<string, unknown>) {
    return this.enterprise.trackAnalytics(body);
  }

  @Get("marketplace")
  marketplace(@Query() query: Record<string, string>) {
    return this.enterprise.marketplaceSearch(query);
  }

  @Get("marketplace/categories")
  marketplaceCategories() {
    return this.enterprise.marketplaceCategories();
  }

  @Get("white-label/resolve")
  resolveDomain(@Query("domain") domain: string) {
    return this.enterprise.resolveWhiteLabelDomain(domain);
  }

  @Get("overview")
  @EnterprisePermission(TeamPermission.VIEW_ANALYTICS)
  overview(@CurrentUser() user: RequestUser) {
    return this.enterprise.overview(user);
  }

  @Get("white-label")
  @EnterprisePermission(TeamPermission.MANAGE_WHITE_LABEL)
  whiteLabel(@CurrentUser() user: RequestUser) {
    return this.enterprise.getWhiteLabel(user);
  }

  @Patch("white-label")
  @EnterprisePermission(TeamPermission.MANAGE_WHITE_LABEL)
  upsertWhiteLabel(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.upsertWhiteLabel(user, body);
  }

  @Post("mobile/devices")
  @EnterprisePermission(TeamPermission.CHECK_IN)
  registerDevice(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.registerMobileDevice(user, body);
  }

  @Post("mobile/checkin-sync")
  @EnterprisePermission(TeamPermission.CHECK_IN)
  syncOfflineCheckins(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.syncOfflineCheckins(user, body);
  }

  @Get("affiliates")
  @EnterprisePermission(TeamPermission.MANAGE_AFFILIATES)
  affiliates(@CurrentUser() user: RequestUser) {
    return this.enterprise.affiliateDashboard(user);
  }

  @Patch("affiliates/program")
  @EnterprisePermission(TeamPermission.MANAGE_AFFILIATES)
  upsertAffiliateProgram(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.upsertAffiliateProgram(user, body);
  }

  @Post("affiliates/links")
  @EnterprisePermission(TeamPermission.MANAGE_AFFILIATES)
  createAffiliateLink(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createAffiliateLink(user, body);
  }

  @Get("crm/customers")
  @EnterprisePermission(TeamPermission.MANAGE_CRM)
  crmCustomers(@CurrentUser() user: RequestUser, @Query() query: Record<string, string>) {
    return this.enterprise.crmCustomers(user, query);
  }

  @Post("crm/customers")
  @EnterprisePermission(TeamPermission.MANAGE_CRM)
  createCrmCustomer(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createCrmCustomer(user, body);
  }

  @Post("crm/segments")
  @EnterprisePermission(TeamPermission.MANAGE_CRM)
  createSegment(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createSegment(user, body);
  }

  @Post("crm/campaigns")
  @EnterprisePermission(TeamPermission.MANAGE_MARKETING)
  createCampaign(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createCampaign(user, body);
  }

  @Post("crm/automations")
  @EnterprisePermission(TeamPermission.MANAGE_MARKETING)
  createAutomation(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createAutomation(user, body);
  }

  @Get("marketing")
  @EnterprisePermission(TeamPermission.MANAGE_MARKETING)
  marketing(@CurrentUser() user: RequestUser) {
    return this.enterprise.marketingDashboard(user);
  }

  @Post("marketing/messages")
  @EnterprisePermission(TeamPermission.MANAGE_MARKETING)
  queueMessage(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.queueMarketingMessage(user, body);
  }

  @Get("analytics")
  @EnterprisePermission(TeamPermission.VIEW_ANALYTICS)
  analytics(@CurrentUser() user: RequestUser, @Query() query: Record<string, string>) {
    return this.enterprise.analyticsDashboard(user, query);
  }

  @Post("analytics/integrations")
  @EnterprisePermission(TeamPermission.VIEW_ANALYTICS)
  upsertAnalyticsIntegration(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.upsertAnalyticsIntegration(user, body);
  }

  @Post("api/clients")
  @EnterprisePermission(TeamPermission.MANAGE_PUBLIC_API)
  createApiClient(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createApiClient(user, body);
  }

  @Post("api/keys")
  @EnterprisePermission(TeamPermission.MANAGE_PUBLIC_API)
  createApiKey(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createApiKey(user, body);
  }

  @Get("seat-maps/:eventId")
  @EnterprisePermission(TeamPermission.MANAGE_SEAT_MAPS)
  seatMaps(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string) {
    return this.enterprise.seatMaps(user, eventId);
  }

  @Post("seat-maps/:eventId")
  @EnterprisePermission(TeamPermission.MANAGE_SEAT_MAPS)
  createSeatMap(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Body() body: Record<string, unknown>) {
    return this.enterprise.createSeatMap(user, eventId, body);
  }

  @Post("seat-maps/:eventId/hold")
  @EnterprisePermission(TeamPermission.MANAGE_SEAT_MAPS)
  holdSeats(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Body() body: Record<string, unknown>) {
    return this.enterprise.holdSeats(user, eventId, body);
  }

  @Post("seat-maps/:eventId/reserve")
  @EnterprisePermission(TeamPermission.MANAGE_SEAT_MAPS)
  reserveSeats(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Body() body: Record<string, unknown>) {
    return this.enterprise.reserveSeats(user, eventId, body);
  }

  @Patch("marketplace/profile")
  @EnterprisePermission(TeamPermission.EDIT_EVENT)
  upsertMarketplaceProfile(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.upsertMarketplaceProfile(user, body);
  }

  @Post("marketplace/reviews")
  @EnterpriseRoles(...authenticatedRoles)
  reviewEvent(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.reviewEvent(user, body);
  }

  @Post("marketplace/favorites")
  @EnterpriseRoles(...authenticatedRoles)
  favoriteEvent(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.favoriteEvent(user, body);
  }

  @Get("ai")
  @EnterprisePermission(TeamPermission.VIEW_ANALYTICS)
  ai(@CurrentUser() user: RequestUser) {
    return this.enterprise.aiDashboard(user);
  }

  @Post("ai/forecast")
  @EnterprisePermission(TeamPermission.VIEW_ANALYTICS)
  createForecast(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createForecast(user, body);
  }

  @Get("executive")
  @EnterprisePermission(TeamPermission.VIEW_ANALYTICS)
  executive(@CurrentUser() user: RequestUser) {
    return this.enterprise.executiveDashboard(user);
  }

  @Get("security")
  @EnterprisePermission(TeamPermission.MANAGE_SECURITY)
  security(@CurrentUser() user: RequestUser) {
    return this.enterprise.securityDashboard(user);
  }

  @Post("security/2fa")
  @EnterprisePermission(TeamPermission.MANAGE_SECURITY)
  enableTwoFactor(@CurrentUser() user: RequestUser) {
    return this.enterprise.enableTwoFactor(user);
  }

  @Post("security/backups")
  @EnterprisePermission(TeamPermission.MANAGE_SECURITY)
  scheduleBackup(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.scheduleBackup(user, body);
  }

  @Get("infrastructure")
  @EnterprisePermission(TeamPermission.MANAGE_SECURITY)
  infrastructure() {
    return this.enterprise.infrastructureBlueprint();
  }
}
