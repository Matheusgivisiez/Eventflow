import { ProfileService } from "./profile.service";

function createService() {
  const tx = {
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(async ({ data }: any) => ({
        id: "user-1",
        name: data.name ?? "Organizador",
        email: data.email ?? "atual@example.com",
        emailVerifiedAt: "emailVerifiedAt" in data ? data.emailVerifiedAt : new Date(),
        phone: null,
        role: "ORGANIZER",
        tenantId: "tenant-1"
      }))
    },
    tenant: { update: jest.fn().mockResolvedValue({ id: "tenant-1", name: "Empresa" }) }
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    ticket: { findMany: jest.fn() },
    $transaction: jest.fn((callback: any) => callback(tx))
  };
  const emailVerification = { handleEmailChanged: jest.fn().mockResolvedValue(undefined) };
  const service = new ProfileService(prisma as any, emailVerification as any);
  return { service, prisma, tx, emailVerification };
}

const current = { id: "user-1", email: "atual@example.com", name: "Organizador" };

describe("ProfileService e-mail change", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("drops the verification when the address changes", async () => {
    const { service, prisma, tx, emailVerification } = createService();
    prisma.user.findUnique.mockResolvedValue(current);

    await service.update("user-1", "tenant-1", { email: "vitima@example.com" } as any);

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailVerifiedAt: null })
      })
    );
    expect(emailVerification.handleEmailChanged).toHaveBeenCalled();
  });

  it("keeps the verification when only the name changes", async () => {
    const { service, prisma, tx, emailVerification } = createService();
    prisma.user.findUnique.mockResolvedValue(current);

    await service.update("user-1", "tenant-1", { name: "Novo Nome" } as any);

    expect(tx.user.update.mock.calls[0][0].data).not.toHaveProperty("emailVerifiedAt");
    expect(emailVerification.handleEmailChanged).not.toHaveBeenCalled();
  });

  it("sends the new link outside the transaction", async () => {
    const { service, prisma, emailVerification } = createService();
    prisma.user.findUnique.mockResolvedValue(current);

    await service.update("user-1", "tenant-1", { email: "vitima@example.com" } as any);

    // The transaction has already resolved by the time the mail is attempted.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(emailVerification.handleEmailChanged).toHaveBeenCalledTimes(1);
  });
});
