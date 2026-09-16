import { Module } from "@nestjs/common";
import { GoogleWalletService } from "./google-wallet.service";

@Module({
  providers: [GoogleWalletService],
  exports: [GoogleWalletService],
})
export class WalletModule {}
