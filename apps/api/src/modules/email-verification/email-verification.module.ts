import { Module } from "@nestjs/common";
import { MailService } from "../../common/services/mail.service";
import { EmailVerificationService } from "./email-verification.service";

@Module({
  providers: [EmailVerificationService, MailService],
  exports: [EmailVerificationService]
})
export class EmailVerificationModule {}
