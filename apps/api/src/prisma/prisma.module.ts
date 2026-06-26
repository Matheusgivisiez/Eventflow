import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "./prisma.service";
import { PrismaReadService } from "./prisma-read.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaService, PrismaReadService],
  exports: [PrismaService, PrismaReadService]
})
export class PrismaModule {}
