import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { EnterpriseController } from "./enterprise.controller";
import { EnterpriseService } from "./enterprise.service";
import { EnterpriseAffiliatesService } from "./services/enterprise-affiliates.service";
import { EnterpriseAiService } from "./services/enterprise-ai.service";
import { EnterpriseAnalyticsService } from "./services/enterprise-analytics.service";
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

@Module({
  imports: [PrismaModule],
  controllers: [EnterpriseController],
  providers: [
    EnterpriseService,
    EnterpriseAffiliatesService,
    EnterpriseAiService,
    EnterpriseAnalyticsService,
    EnterpriseCrmService,
    EnterpriseInfrastructureService,
    EnterpriseMarketplaceService,
    EnterpriseMarketingService,
    EnterpriseMobileService,
    EnterpriseOverviewService,
    EnterprisePublicApiService,
    EnterpriseSeatMapsService,
    EnterpriseSecurityService,
    EnterpriseWhiteLabelService
  ]
})
export class EnterpriseModule {}
