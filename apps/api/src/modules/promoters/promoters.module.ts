import { Module } from "@nestjs/common";
import { PromotersController } from "./promoters.controller";
import { PromotersService } from "./promoters.service";
import { PromoterPortalController } from "./promoter-portal.controller";
import { PromoterPortalService } from "./promoter-portal.service";
import { PromoterTrackController } from "./promoter-track.controller";

@Module({
  controllers: [PromotersController, PromoterPortalController, PromoterTrackController],
  providers: [PromotersService, PromoterPortalService],
  exports: [PromotersService, PromoterPortalService]
})
export class PromotersModule {}
