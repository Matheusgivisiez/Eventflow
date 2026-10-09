import { EmailVerificationService } from "./email-verification.service";

function createService() {
  const prisma = {
    emailVerificationToken: {
      updateMany: jest.fn(),
      create: jest.fn()
    },
    $transaction: jest.fn().mockResolvedValue([])
  };
  const mail = { send: jest.fn().mockResolvedValue({ status: "SENT" }) };
  const config = {
    get: jest.fn((key: string): any => (key === "APP_URL" ? "https://app.example" : undefined))
  };
  const service = new EmailVerificationService(prisma as any, mail as any, config as any);
  return { service, prisma, mail };
}

const user = { id: "user-1", email: "Nova@Example.COM", name: "Comprador <b>" };

describe("EmailVerificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("issues a link and reports success", async () => {
    const { service, mail } = createService();

    await expect(service.issue(user)).resolves.toBe(true);
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "nova@example.com" })
    );
  });

  it("does not throw when token creation fails", async () => {
    // The caller already wrote the new address. Throwing here would answer 500
    // for a change that did happen, and the user would believe it did not.
    const { service, prisma, mail } = createService();
    prisma.emailVerificationToken.create.mockRejectedValue(new Error("deadlock"));

    await expect(service.issue(user)).resolves.toBe(false);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("does not throw when SMTP fails", async () => {
    const { service, mail } = createService();
    mail.send.mockRejectedValue(new Error("SMTP down"));

    await expect(service.issue(user)).resolves.toBe(false);
  });

  it("does not throw from the e-mail change entry point either", async () => {
    const { service, prisma } = createService();
    prisma.emailVerificationToken.create.mockRejectedValue(new Error("deadlock"));

    await expect(service.handleEmailChanged(user)).resolves.toBe(false);
  });

  it("keeps earlier links active until verification succeeds", async () => {
    const { service, prisma } = createService();

    await service.handleEmailChanged(user);

    expect(prisma.emailVerificationToken.create).toHaveBeenCalledTimes(1);
    expect(prisma.emailVerificationToken.updateMany).not.toHaveBeenCalled();
  });

  it("marks a skipped e-mail as failed and lets the user request another link", async () => {
    const { service, prisma, mail } = createService();
    mail.send.mockResolvedValue({ status: "SKIPPED" });

    await expect(service.issue(user)).resolves.toBe(false);
    expect(prisma.emailVerificationToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String), usedAt: null },
      data: { usedAt: expect.any(Date) }
    });
  });

  it("stores only the hash and escapes the name in the message", async () => {
    const { service, prisma, mail } = createService();

    await service.issue(user);

    const created = prisma.emailVerificationToken.create.mock.calls[0][0].data;
    const html = mail.send.mock.calls[0][0].html as string;
    const rawToken = /token=([^"&]+)/.exec(html)?.[1];

    expect(rawToken).toBeTruthy();
    expect(created.tokenHash).not.toEqual(rawToken);
    expect(created.email).toBe("nova@example.com");
    expect(html).toContain("Comprador &lt;b&gt;");
  });

  describe("isEmailChange", () => {
    it("ignores case and surrounding spaces", () => {
      expect(EmailVerificationService.isEmailChange("a@b.com", "  A@B.com ")).toBe(false);
    });

    it("detects a real change", () => {
      expect(EmailVerificationService.isEmailChange("a@b.com", "vitima@b.com")).toBe(true);
    });

    it("treats an absent address as no change", () => {
      expect(EmailVerificationService.isEmailChange("a@b.com", undefined)).toBe(false);
    });
  });
});
