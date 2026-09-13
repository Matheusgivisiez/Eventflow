import { Module } from "@nestjs/common";
import { EmailVerificationModule } from "../email-verification/email-verification.module";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  imports: [EmailVerificationModule],
  controllers: [ProfileController],
  providers: [ProfileService]
})
export class ProfileModule {}
