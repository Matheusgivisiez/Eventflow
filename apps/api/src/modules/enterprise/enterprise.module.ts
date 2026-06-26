import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { EnterpriseController } from "./enterprise.controller";
import { EnterpriseService } from "./enterprise.service";

@Module({
  imports: [PrismaModule],
  controllers: [EnterpriseController],
  providers: [EnterpriseService]
})
export class EnterpriseModule {}
