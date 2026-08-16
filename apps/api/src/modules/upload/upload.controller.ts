import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { UploadStorageService } from "./upload-storage.service";

@ApiTags("Upload")
@Controller("upload")
export class UploadController {
  constructor(private readonly storage: UploadStorageService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }
    })
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    const stored = await this.storage.store(file);
    return { url: stored.url };
  }
}
