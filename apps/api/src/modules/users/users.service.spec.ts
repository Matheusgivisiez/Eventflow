import { BadRequestException } from "@nestjs/common";
import { UsersService } from "./users.service";

function createService() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
      update: jest.fn(async ({ data }: any) => ({
        id: "user-1",
        name: data.name ?? "Comprador",
        email: data.email ?? "atual@example.com",
        emailVerifiedAt: "emailVerifiedAt" in data ? data.emailVerifiedAt : new Date(),
        phone: null,
        role: "CUSTOMER",
        updatedAt: new Date()
      }))
    }
  };
  const emailVerification = { handleEmailChanged: jest.fn().mockResolvedValue(undefined) };
  const service = new UsersService(prisma as any, emailVerification as any);
  return { service, prisma, emailVerification };
}

const current = {
  id: "user-1",
  email: "atual@example.com",
  name: "Comprador",
  tenantId: "tenant-1"
};

describe("UsersService e-mail change", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("drops the verification when the account moves to another address", async () => {
    // Without this, an account verified under its own address could switch to
    // a victim's address and keep the proof, reopening the claim by e-mail.
    const { service, prisma, emailVerification } = createService();
    prisma.user.findUnique.mockResolvedValue(current);

    await service.updateMe("user-1", { email: "vitima@example.com" });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "vitima@example.com",
          emailVerifiedAt: null
        })
      })
    );
    expect(emailVerification.handleEmailChanged).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1", email: "vitima@example.com" })
    );
  });

  it("keeps the verification when the address did not really change", async () => {
    const { service, prisma, emailVerification } = createService();
    prisma.user.findUnique.mockResolvedValue(current);

    await service.updateMe("user-1", { name: "Outro Nome", email: "ATUAL@Example.com" });

    expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty("emailVerifiedAt");
    expect(emailVerification.handleEmailChanged).not.toHaveBeenCalled();
  });

  it("keeps the verification when no address is sent", async () => {
    const { service, prisma, emailVerification } = createService();
    prisma.user.findUnique.mockResolvedValue(current);

    await service.updateMe("user-1", { name: "Outro Nome" });

    expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty("emailVerifiedAt");
    expect(emailVerification.handleEmailChanged).not.toHaveBeenCalled();
  });

  it("refuses an address already used by another account", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(current);
    prisma.user.findFirst.mockResolvedValue({ id: "user-2" });

    await expect(service.updateMe("user-1", { email: "outro@example.com" })).rejects.toThrow(
      BadRequestException
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("applies the same rule on the tenant route", async () => {
    const { service, prisma, emailVerification } = createService();
    prisma.user.findFirst.mockResolvedValueOnce(current).mockResolvedValueOnce(null);

    await service.update("user-1", "tenant-1", { email: "vitima@example.com" });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailVerifiedAt: null })
      })
    );
    expect(emailVerification.handleEmailChanged).toHaveBeenCalled();
  });
});
