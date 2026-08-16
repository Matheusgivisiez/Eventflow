import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";
import * as fs from "fs/promises";
import { extname, join } from "path";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const LOCAL_UPLOADS_DIR = join(process.cwd(), "uploads");

export type StoredUpload = {
  url: string;
  key: string;
  storage: "s3" | "local";
};

@Injectable()
export class UploadStorageService {
  private s3?: S3Client;

  constructor(private readonly config: ConfigService) {}

  async store(file: Express.Multer.File): Promise<StoredUpload> {
    this.validate(file);

    const key = this.createObjectKey(file.originalname);
    const bucket = this.config.get<string>("AWS_S3_ASSETS_BUCKET");
    const publicUrl = this.config.get<string>("AWS_S3_ASSETS_PUBLIC_URL");
    const nodeEnv = this.config.get<string>("NODE_ENV") ?? "development";

    if (bucket && publicUrl) {
      await this.s3Client().send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: "public, max-age=31536000, immutable"
      }));

      return {
        url: `${publicUrl.replace(/\/$/, "")}/${key}`,
        key,
        storage: "s3"
      };
    }

    if (nodeEnv === "production") {
      throw new ServiceUnavailableException("Storage externo nao configurado.");
    }

    await fs.mkdir(LOCAL_UPLOADS_DIR, { recursive: true });
    const localName = key.replace(/\//g, "-");
    await fs.writeFile(join(LOCAL_UPLOADS_DIR, localName), file.buffer);

    return {
      url: `/uploads/${localName}`,
      key: localName,
      storage: "local"
    };
  }

  validate(file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Nenhum arquivo enviado.");

    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Formato invalido. Use: jpg, png, gif, webp.");
    }

    if (!this.hasValidMagicNumber(file.buffer)) {
      throw new BadRequestException("Arquivo corrompido ou tipo invalido. Assinatura do arquivo nao confere.");
    }
  }

  private s3Client() {
    if (!this.s3) {
      const accessKeyId = this.config.get<string>("AWS_ACCESS_KEY_ID");
      const secretAccessKey = this.config.get<string>("AWS_SECRET_ACCESS_KEY");
      const endpoint = this.config.get<string>("AWS_S3_ENDPOINT");

      this.s3 = new S3Client({
        region: this.config.get<string>("AWS_REGION") ?? "us-east-1",
        endpoint,
        forcePathStyle: this.config.get<boolean>("AWS_S3_FORCE_PATH_STYLE") ?? false,
        credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined
      });
    }

    return this.s3;
  }

  private createObjectKey(originalName: string) {
    const ext = extname(originalName).toLowerCase();
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `assets/${year}/${month}/${randomBytes(16).toString("hex")}${ext}`;
  }

  private hasValidMagicNumber(buffer: Buffer) {
    const hex = buffer.toString("hex", 0, 4).toUpperCase();
    if (hex.startsWith("FFD8FF")) return true;
    if (hex === "89504E47") return true;
    if (hex === "47494638") return true;
    return buffer.toString("utf8", 0, 4) === "RIFF" && buffer.toString("utf8", 8, 12) === "WEBP";
  }
}
