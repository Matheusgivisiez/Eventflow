import { EmailVerificationService } from "../email-verification/email-verification.service";
import { AuthService } from "./auth.service";
import * as bcrypt from "bcryptjs";

function createService() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn()
    },
    passwordResetToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    emailVerificationToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    refreshToken: {
      updateMany: jest.fn(),
      create: jest.fn()
    },
    $transaction: jest.fn((operations) => Promise.all(operations))
  };
  const jwt = { signAsync: jest.fn() };
  const config = {
    get: jest.fn((key: string) => key === "APP_URL" ? "https://app.example" : undefined),
    getOrThrow: jest.fn()
  };
  const mail = { send: jest.fn().mockResolvedValue({ status: "SENT" }) };
  // The real verification service, on the same mocks: the tests below assert
  // on the token row it writes and the mail it sends.
  const emailVerification = new EmailVerificationService(prisma as any, mail as any, config as any);
  const service = new AuthService(prisma as any, jwt as any, config as any, mail as any, emailVerification);
  return { service, prisma, mail, emailVerification };
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

    expect(result).toEqual({ message: "Se o e-mail existir, enviaremos instruções de recuperação." });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("creates a hashed reset token and sends a reset link without returning the token", async () => {
    const { service, prisma, mail } = createService();
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    prisma.passwordResetToken.create.mockResolvedValue({});
    mail.send.mockResolvedValue({ status: "SENT" });

    const result = await service.forgotPassword({ email: "USER@example.com" });

    expect(result).toEqual({ message: "Se o e-mail existir, enviaremos instruções de recuperação." });
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
      subject: "Recuperação de senha Event Flow",
      text: expect.stringContaining("https://app.example/reset-password?token="),
      html: expect.stringContaining("https://app.example/reset-password?token=")
    }));
  });
});

describe("AuthService resetPassword", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("increments the user token version and revokes refresh tokens", async () => {
    const { service, prisma } = createService();
    prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: "reset-1",
      userId: "user-1"
    });
    prisma.user.update.mockResolvedValue({});
    prisma.passwordResetToken.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    await service.resetPassword({ token: "reset-token", password: "nova-senha-segura" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        passwordHash: expect.any(String),
        tokenVersion: { increment: 1 }
      }
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
  });
});

describe("AuthService e-mail verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not disclose whether an account exists when resending the link", async () => {
    const { service, prisma, mail } = createService();
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.resendEmailVerification("missing@example.com");

    expect(result).toEqual({
      message: "Se a conta existir e ainda não estiver confirmada, enviaremos um novo link."
    });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("does not resend a link for an account that is already verified", async () => {
    const { service, prisma, mail } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Buyer",
      email: "buyer@example.com",
      emailVerifiedAt: new Date()
    });

    await service.resendEmailVerification("buyer@example.com");

    expect(mail.send).not.toHaveBeenCalled();
    expect(prisma.emailVerificationToken.create).not.toHaveBeenCalled();
  });

  it("resends a link that brings the buyer back to the checkout", async () => {
    const { service, prisma, mail } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1", name: "Buyer", email: "buyer@example.com", emailVerifiedAt: null
    });
    prisma.emailVerificationToken.findFirst.mockResolvedValue(null);

    await service.resendEmailVerification("buyer@example.com", "/checkout/hallowparty-vi6WC3?items=lote-1:1");

    const text = mail.send.mock.calls[0][0].text as string;
    expect(new URL(text.slice(text.indexOf("http"))).searchParams.get("next"))
      .toBe("/checkout/hallowparty-vi6WC3?items=lote-1:1");
  });

  it("checks cooldown only against active links for the current address", async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1", name: "Buyer", email: "buyer@example.com", emailVerifiedAt: null
    });
    prisma.emailVerificationToken.findFirst.mockResolvedValue(null);

    await service.resendEmailVerification("buyer@example.com");

    expect(prisma.emailVerificationToken.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1", email: "buyer@example.com", usedAt: null, expiresAt: { gt: expect.any(Date) } }
    }));
  });

  it("stores only the hash of the verification token and never the raw value", async () => {
    const { service, prisma, mail } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Buyer",
      email: "buyer@example.com",
      emailVerifiedAt: null
    });
    prisma.emailVerificationToken.findFirst.mockResolvedValue(null);

    await service.resendEmailVerification("buyer@example.com");

    const created = prisma.emailVerificationToken.create.mock.calls[0][0].data;
    const sentHtml = mail.send.mock.calls[0][0].html as string;
    const rawToken = /token=([^"&]+)/.exec(sentHtml)?.[1];

    expect(rawToken).toBeTruthy();
    expect(created.tokenHash).not.toEqual(rawToken);
    expect(created.email).toBe("buyer@example.com");
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a token whose address is no longer the account address", async () => {
    const { service, prisma } = createService();
    prisma.emailVerificationToken.findFirst.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      email: "old@example.com",
      usedAt: null,
      user: { id: "user-1", email: "new@example.com", emailVerifiedAt: null }
    });

    await expect(service.verifyEmail("raw-token")).rejects.toThrow();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an expired or already used token", async () => {
    const { service, prisma } = createService();
    prisma.emailVerificationToken.findFirst.mockResolvedValue(null);

    await expect(service.verifyEmail("raw-token")).rejects.toThrow();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("accepts a second click on a link after the address was verified", async () => {
    const { service, prisma } = createService();
    prisma.emailVerificationToken.findFirst.mockResolvedValue({
      id: "token-1", userId: "user-1", email: "buyer@example.com", usedAt: new Date(),
      user: { id: "user-1", email: "buyer@example.com", emailVerifiedAt: new Date() }
    });

    await expect(service.verifyEmail("raw-token")).resolves.toEqual({
      message: "E-mail confirmado com sucesso.", email: "buyer@example.com"
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("does not let a mail outage break the sign-up", async () => {
    const { service, prisma, mail } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Buyer",
      email: "buyer@example.com",
      emailVerifiedAt: null
    });
    prisma.emailVerificationToken.findFirst.mockResolvedValue(null);
    mail.send.mockRejectedValue(new Error("SMTP down"));

    await expect(service.resendEmailVerification("buyer@example.com")).resolves.toBeDefined();
  });
});

describe("AuthService new-account access", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates a pending account without issuing a session", async () => {
    const { service, prisma, mail } = createService();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "new-user", email: "new@example.com", name: "New" });

    await expect(service.register({
      name: "New", email: "new@example.com", password: "password123", phone: "11999999999", cpf: "12345678909"
    })).resolves.toEqual({ email: "new@example.com", verificationEmailSent: true });

    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ emailVerificationRequired: true })
    }));
    expect(mail.send).toHaveBeenCalled();
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("blocks login only for a new account awaiting confirmation", async () => {
    const { service, prisma } = createService();
    const passwordHash = await bcrypt.hash("password123", 4);
    prisma.user.findUnique.mockResolvedValue({
      id: "new-user", email: "new@example.com", passwordHash,
      emailVerificationRequired: true, emailVerifiedAt: null
    });

    await expect(service.login({ email: "new@example.com", password: "password123" }))
      .rejects.toThrow("Confirme seu e-mail");
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("allows a new account to log in after confirmation", async () => {
    const { service, prisma } = createService();
    const passwordHash = await bcrypt.hash("password123", 4);
    prisma.user.findUnique.mockResolvedValue({
      id: "new-user", email: "new@example.com", passwordHash,
      emailVerificationRequired: true, emailVerifiedAt: new Date()
    });
    (service as any).issueSession = jest.fn().mockResolvedValue({ accessToken: "confirmed-session" });

    await expect(service.login({ email: "new@example.com", password: "password123" }))
      .resolves.toEqual({ accessToken: "confirmed-session" });
  });

  it("keeps an existing unverified account able to log in", async () => {
    const { service, prisma } = createService();
    const passwordHash = await bcrypt.hash("password123", 4);
    prisma.user.findUnique.mockResolvedValue({
      id: "existing-user", email: "existing@example.com", passwordHash,
      emailVerificationRequired: false, emailVerifiedAt: null
    });
    (service as any).issueSession = jest.fn().mockResolvedValue({ accessToken: "existing-session" });

    await expect(service.login({ email: "existing@example.com", password: "password123" }))
      .resolves.toEqual({ accessToken: "existing-session" });
  });
});
