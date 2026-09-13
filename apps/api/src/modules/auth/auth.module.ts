import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { MailService } from "../../common/services/mail.service";
import { EmailVerificationModule } from "../email-verification/email-verification.module";

@Module({
  imports: [PassportModule, JwtModule.register({}), EmailVerificationModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, MailService],
  exports: [AuthService]
})
export class AuthModule {}
