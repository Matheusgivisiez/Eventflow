import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { UploadController } from "./upload.controller";

describe("UploadController", () => {
  it("requires JWT guard for uploads", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, UploadController.prototype.upload) ?? [];

    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard]));
  });

  it("returns only the stored public URL", async () => {
    const storage = {
      store: jest.fn().mockResolvedValue({
        url: "https://cdn.example.com/assets/file.png",
        key: "assets/file.png",
        storage: "s3"
      })
    };
    const controller = new UploadController(storage as any);

    const result = await controller.upload({ originalname: "file.png" } as Express.Multer.File);

    expect(storage.store).toHaveBeenCalledWith({ originalname: "file.png" });
    expect(result).toEqual({ url: "https://cdn.example.com/assets/file.png" });
  });
});
