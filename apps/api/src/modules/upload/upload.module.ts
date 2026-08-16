import { Module } from "@nestjs/common";
import { UploadController } from "./upload.controller";
import { UploadStorageService } from "./upload-storage.service";

@Module({
  controllers: [UploadController],
  providers: [UploadStorageService]
})
export class UploadModule {}
