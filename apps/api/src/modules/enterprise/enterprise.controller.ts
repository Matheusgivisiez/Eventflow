import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RequestUser } from "../../common/types/request-user";
import { EnterpriseService } from "./enterprise.service";

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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  overview(@CurrentUser() user: RequestUser) {
    return this.enterprise.overview(user);
  }

  @Get("white-label")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  whiteLabel(@CurrentUser() user: RequestUser) {
    return this.enterprise.getWhiteLabel(user);
  }

  @Patch("white-label")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  upsertWhiteLabel(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.upsertWhiteLabel(user, body);
  }

  @Post("mobile/devices")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  registerDevice(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.registerMobileDevice(user, body);
  }

  @Post("mobile/checkin-sync")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  syncOfflineCheckins(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.syncOfflineCheckins(user, body);
  }

  @Get("affiliates")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  affiliates(@CurrentUser() user: RequestUser) {
    return this.enterprise.affiliateDashboard(user);
  }

  @Patch("affiliates/program")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  upsertAffiliateProgram(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.upsertAffiliateProgram(user, body);
  }

  @Post("affiliates/links")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createAffiliateLink(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createAffiliateLink(user, body);
  }

  @Get("crm/customers")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  crmCustomers(@CurrentUser() user: RequestUser, @Query() query: Record<string, string>) {
    return this.enterprise.crmCustomers(user, query);
  }

  @Post("crm/customers")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createCrmCustomer(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createCrmCustomer(user, body);
  }

  @Post("crm/segments")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createSegment(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createSegment(user, body);
  }

  @Post("crm/campaigns")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createCampaign(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createCampaign(user, body);
  }

  @Post("crm/automations")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createAutomation(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createAutomation(user, body);
  }

  @Get("marketing")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  marketing(@CurrentUser() user: RequestUser) {
    return this.enterprise.marketingDashboard(user);
  }

  @Post("marketing/messages")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  queueMessage(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.queueMarketingMessage(user, body);
  }

  @Get("analytics")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  analytics(@CurrentUser() user: RequestUser, @Query() query: Record<string, string>) {
    return this.enterprise.analyticsDashboard(user, query);
  }

  @Post("analytics/integrations")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  upsertAnalyticsIntegration(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.upsertAnalyticsIntegration(user, body);
  }

  @Post("api/clients")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createApiClient(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createApiClient(user, body);
  }

  @Post("api/keys")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createApiKey(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createApiKey(user, body);
  }

  @Get("seat-maps/:eventId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  seatMaps(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string) {
    return this.enterprise.seatMaps(user, eventId);
  }

  @Post("seat-maps/:eventId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createSeatMap(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Body() body: Record<string, unknown>) {
    return this.enterprise.createSeatMap(user, eventId, body);
  }

  @Post("seat-maps/:eventId/hold")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  holdSeats(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Body() body: Record<string, unknown>) {
    return this.enterprise.holdSeats(user, eventId, body);
  }

  @Post("seat-maps/:eventId/reserve")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  reserveSeats(@CurrentUser() user: RequestUser, @Param("eventId") eventId: string, @Body() body: Record<string, unknown>) {
    return this.enterprise.reserveSeats(user, eventId, body);
  }

  @Patch("marketplace/profile")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  upsertMarketplaceProfile(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.upsertMarketplaceProfile(user, body);
  }

  @Post("marketplace/reviews")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  reviewEvent(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.reviewEvent(user, body);
  }

  @Post("marketplace/favorites")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  favoriteEvent(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.favoriteEvent(user, body);
  }

  @Get("ai")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  ai(@CurrentUser() user: RequestUser) {
    return this.enterprise.aiDashboard(user);
  }

  @Post("ai/forecast")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createForecast(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.createForecast(user, body);
  }

  @Get("executive")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  executive(@CurrentUser() user: RequestUser) {
    return this.enterprise.executiveDashboard(user);
  }

  @Get("security")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  security(@CurrentUser() user: RequestUser) {
    return this.enterprise.securityDashboard(user);
  }

  @Post("security/2fa")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  enableTwoFactor(@CurrentUser() user: RequestUser) {
    return this.enterprise.enableTwoFactor(user);
  }

  @Post("security/backups")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  scheduleBackup(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.enterprise.scheduleBackup(user, body);
  }

  @Get("infrastructure")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  infrastructure() {
    return this.enterprise.infrastructureBlueprint();
  }
}
