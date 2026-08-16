import { AuthService } from "./auth.service";

function createService() {
  const prisma = {
    user: {
      findUnique: jest.fn()
    },
    passwordResetToken: {
      create: jest.fn()
    },
    refreshToken: {
      updateMany: jest.fn()
    }
  };
  const jwt = { signAsync: jest.fn() };
  const config = {
    get: jest.fn((key: string) => key === "APP_URL" ? "https://app.example" : undefined),
    getOrThrow: jest.fn()
  };
  const mail = { send: jest.fn() };
  const service = new AuthService(prisma as any, jwt as any, config as any, mail as any);
  return { service, prisma, mail };
}

describe("AuthService logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("revokes the hashed refresh token without using the raw token in the query", async () => {
    const { service, prisma } = createService();

    await service.logout("raw-refresh-token");

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: expect.not.stringMatching("raw-refresh-token"),
        revokedAt: null
      },
      data: { revokedAt: expect.any(Date) }
    });
  });

  it("does not touch the database when no refresh token is present", async () => {
    const { service, prisma } = createService();

    await service.logout();

    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

describe("AuthService forgotPassword", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not disclose whether the email exists and does not send mail for unknown users", async () => {
    const { service, prisma, mail } = createService();
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.forgotPassword({ email: "missing@example.com" });

    expect(result).toEqual({ message: "Se o e-mail existir, enviaremos instrucoes de recuperacao." });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("creates a hashed reset token and sends a reset link without returning the token", async () => {
    const { service, prisma, mail } = createService();
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    prisma.passwordResetToken.create.mockResolvedValue({});
    mail.send.mockResolvedValue({ status: "SENT" });

    const result = await service.forgotPassword({ email: "USER@example.com" });

    expect(result).toEqual({ message: "Se o e-mail existir, enviaremos instrucoes de recuperacao." });
    expect(result).not.toHaveProperty("token");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "user@example.com" } });
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date)
      }
    });
    expect(prisma.passwordResetToken.create.mock.calls[0][0].data.tokenHash).not.toContain("user@example.com");
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "user@example.com",
      subject: "Recuperacao de senha Event Flow",
      text: expect.stringContaining("https://app.example/reset-password?token="),
      html: expect.stringContaining("https://app.example/reset-password?token=")
    }));
  });
});
