import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { randomBytes } from "crypto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

const UPLOADS_DIR = join(process.cwd(), "uploads");

@ApiTags("Upload")
@Controller("upload")
export class UploadController {
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          const name = randomBytes(16).toString("hex");
          cb(null, `${name}${ext}`);
        }
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
        const ext = extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException("Formato invalido. Use: jpg, png, gif, webp."), false);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }
    })
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Nenhum arquivo enviado.");
    return { url: `/uploads/${file.filename}` };
  }
}
