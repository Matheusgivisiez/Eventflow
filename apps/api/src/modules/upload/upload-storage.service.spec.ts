import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as fs from "fs/promises";
import { UploadStorageService } from "./upload-storage.service";

jest.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: jest.fn((input) => ({ input })),
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({})
  }))
}));

function createConfig(values: Record<string, unknown>) {
  return {
    get: jest.fn((key: string) => values[key])
  };
}

function pngFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    originalname: "banner.png",
    mimetype: "image/png",
    buffer: Buffer.from("89504E470D0A1A0A", "hex"),
    size: 8,
    fieldname: "file",
    encoding: "7bit",
    destination: "",
    filename: "",
    path: "",
    stream: undefined as never,
    ...overrides
  };
}

describe("UploadStorageService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uploads valid assets to S3 and returns a public external URL", async () => {
    const service = new UploadStorageService(createConfig({
      NODE_ENV: "production",
      AWS_ACCESS_KEY_ID: "test-access-key",
      AWS_SECRET_ACCESS_KEY: "test-secret-key",
      AWS_REGION: "us-east-1",
      AWS_S3_ASSETS_BUCKET: "eventflow-assets",
      AWS_S3_ASSETS_PUBLIC_URL: "https://cdn.example.com/assets"
    }) as any);

    const result = await service.store(pngFile());

    expect(S3Client).toHaveBeenCalledWith({
      region: "us-east-1",
      endpoint: undefined,
      forcePathStyle: false,
      credentials: {
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key"
      }
    });
    expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: "eventflow-assets",
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable"
    }));
    expect(result.storage).toBe("s3");
    expect(result.url).toMatch(/^https:\/\/cdn\.example\.com\/assets\/assets\/\d{4}\/\d{2}\/[a-f0-9]{32}\.png$/);
  });

  it("supports Cloudflare R2 S3-compatible endpoints", async () => {
    const service = new UploadStorageService(createConfig({
      NODE_ENV: "production",
      AWS_ACCESS_KEY_ID: "r2-access-key",
      AWS_SECRET_ACCESS_KEY: "r2-secret-key",
      AWS_REGION: "auto",
      AWS_S3_ENDPOINT: "https://example-account.r2.cloudflarestorage.com",
      AWS_S3_FORCE_PATH_STYLE: true,
      AWS_S3_ASSETS_BUCKET: "eventflow-assets-staging",
      AWS_S3_ASSETS_PUBLIC_URL: "https://pub-example.r2.dev"
    }) as any);

    await service.store(pngFile());

    expect(S3Client).toHaveBeenCalledWith({
      region: "auto",
      endpoint: "https://example-account.r2.cloudflarestorage.com",
      forcePathStyle: true,
      credentials: {
        accessKeyId: "r2-access-key",
        secretAccessKey: "r2-secret-key"
      }
    });
  });

  it("fails closed in production when external storage is not configured", async () => {
    const service = new UploadStorageService(createConfig({ NODE_ENV: "production" }) as any);

    await expect(service.store(pngFile())).rejects.toThrow(ServiceUnavailableException);
  });

  it("stores locally only outside production when S3 is not configured", async () => {
    jest.spyOn(fs, "mkdir").mockResolvedValue(undefined);
    jest.spyOn(fs, "writeFile").mockResolvedValue(undefined);
    const service = new UploadStorageService(createConfig({ NODE_ENV: "test" }) as any);

    const result = await service.store(pngFile());

    expect(S3Client).not.toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledWith(expect.stringMatching(/uploads\/assets-\d{4}-\d{2}-[a-f0-9]{32}\.png$/), expect.any(Buffer));
    expect(result.storage).toBe("local");
    expect(result.url).toMatch(/^\/uploads\/assets-\d{4}-\d{2}-[a-f0-9]{32}\.png$/);
  });

  it("rejects files when extension or magic number is invalid", async () => {
    const service = new UploadStorageService(createConfig({ NODE_ENV: "test" }) as any);

    await expect(service.store(pngFile({
      originalname: "banner.png",
      mimetype: "image/png",
      buffer: Buffer.from("not-an-image")
    }))).rejects.toThrow(BadRequestException);

    await expect(service.store(pngFile({
      originalname: "banner.svg",
      mimetype: "image/svg+xml"
    }))).rejects.toThrow(BadRequestException);
  });
});
