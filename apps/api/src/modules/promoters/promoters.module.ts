import { Module } from "@nestjs/common";
import { PromotersController } from "./promoters.controller";
import { PromotersService } from "./promoters.service";
import { PromoterPortalController } from "./promoter-portal.controller";
import { PromoterPortalService } from "./promoter-portal.service";

@Module({
  controllers: [PromotersController, PromoterPortalController],
  providers: [PromotersService, PromoterPortalService],
  exports: [PromotersService, PromoterPortalService]
})
export class PromotersModule {}
