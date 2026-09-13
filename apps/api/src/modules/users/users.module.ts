import { Module } from "@nestjs/common";
import { EmailVerificationModule } from "../email-verification/email-verification.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [EmailVerificationModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
