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
import * as fs from "fs/promises";
import * as fsSync from "fs";

const UPLOADS_DIR = join(process.cwd(), "uploads");
if (!fsSync.existsSync(UPLOADS_DIR)) {
  fsSync.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function checkMagicNumberFile(filePath: string): Promise<boolean> {
  try {
    const fileHandle = await fs.open(filePath, "r");
    const buffer = Buffer.alloc(16);
    await fileHandle.read(buffer, 0, 16, 0);
    await fileHandle.close();

    const hex = buffer.toString("hex", 0, 4).toUpperCase();
    if (hex.startsWith("FFD8FF")) return true;
    if (hex === "89504E47") return true;
    if (hex === "47494638") return true;
    if (buffer.toString("utf8", 0, 4) === "RIFF" && buffer.toString("utf8", 8, 12) === "WEBP") return true;
    
    return false;
  } catch (error) {
    return false;
  }
}

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
          const ext = extname(file.originalname).toLowerCase();
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
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Nenhum arquivo enviado.");
    
    const isValid = await checkMagicNumberFile(file.path);
    if (!isValid) {
      await fs.unlink(file.path).catch(() => {});
      throw new BadRequestException("Arquivo corrompido ou tipo invalido. Assinatura do arquivo nao confere.");
    }
    
    return { url: `/uploads/${file.filename}` };
  }
}
