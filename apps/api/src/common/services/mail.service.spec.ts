import * as nodemailer from "nodemailer";
import { MailService } from "./mail.service";

jest.mock("nodemailer", () => ({
  createTransport: jest.fn()
}));

function createConfig(values: Record<string, unknown>) {
  return {
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (!value) throw new Error(`${key} missing`);
      return value;
    })
  };
}

describe("MailService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends email through configured SMTP transport", async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: "message-1" });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    const config = createConfig({
      SMTP_HOST: "smtp.mailtrap.io",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: "smtp-user",
      SMTP_PASS: "smtp-pass",
      SMTP_FROM: "no-reply@eventflow.com.br"
    });
    const service = new MailService(config as any);

    const result = await service.send({
      to: "user@example.com",
      subject: "Reset",
      text: "Reset link",
      html: "<p>Reset link</p>"
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "smtp.mailtrap.io",
      port: 587,
      secure: false,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      auth: {
        user: "smtp-user",
        pass: "smtp-pass"
      }
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: "no-reply@eventflow.com.br",
      to: "user@example.com",
      subject: "Reset",
      text: "Reset link",
      html: "<p>Reset link</p>"
    });
    expect(result).toEqual({
      status: "SENT",
      recipient: "user@example.com",
      messageId: "message-1"
    });
  });

  it("skips dispatch safely when SMTP is not configured", async () => {
    const service = new MailService(createConfig({}) as any);

    const result = await service.send({
      to: "user@example.com",
      subject: "Reset",
      text: "Reset link",
      html: "<p>Reset link</p>"
    });

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "SKIPPED", recipient: "user@example.com" });
  });

  it("skips dispatch safely when SMTP credentials are missing", async () => {
    const service = new MailService(createConfig({
      SMTP_HOST: "smtp.no-credentials.host",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_FROM: "no-reply@eventflow.com.br"
    }) as any);

    const result = await service.send({
      to: "user@example.com",
      subject: "Reset",
      text: "Reset link",
      html: "<p>Reset link</p>"
    });

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "SKIPPED", recipient: "user@example.com" });
  });

  it("treats placeholder SMTP settings as disabled", async () => {
    const service = new MailService(createConfig({
      SMTP_HOST: "placeholder.smtp.local",
      SMTP_PORT: 587,
      SMTP_USER: "smtp-user",
      SMTP_PASS: "smtp-pass",
      SMTP_FROM: "no-reply@eventflow.local"
    }) as any);

    const result = await service.send({
      to: "user@example.com",
      subject: "Reset",
      text: "Reset link",
      html: "<p>Reset link</p>"
    });

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "SKIPPED", recipient: "user@example.com" });
    await expect(service.checkTransport()).resolves.toEqual({ configured: false });
  });

  it("returns unreachable without throwing when SMTP verify rejects", async () => {
    const verify = jest.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND smtp.bad.host"));
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ verify });
    const service = new MailService(createConfig({
      SMTP_HOST: "smtp.bad.host",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: "smtp-user",
      SMTP_PASS: "smtp-pass",
      SMTP_FROM: "no-reply@eventflow.com.br"
    }) as any);

    await expect(service.checkTransport()).resolves.toEqual({
      configured: true,
      reachable: false,
      error: "getaddrinfo ENOTFOUND smtp.bad.host"
    });
  });

  it("does not verify when SMTP_HOST is missing", async () => {
    const verify = jest.fn();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ verify });
    const service = new MailService(createConfig({
      SMTP_FROM: "no-reply@eventflow.com.br"
    }) as any);

    await expect(service.checkTransport()).resolves.toEqual({ configured: false });

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("reports unconfigured when SMTP credentials are missing", async () => {
    const verify = jest.fn();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ verify });
    const service = new MailService(createConfig({
      SMTP_HOST: "smtp.no-credentials.host",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_FROM: "no-reply@eventflow.com.br"
    }) as any);

    await expect(service.checkTransport()).resolves.toEqual({ configured: false });

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it("times out SMTP verification instead of waiting for nodemailer defaults", async () => {
    jest.useFakeTimers();
    const verify = jest.fn().mockReturnValue(new Promise(() => undefined));
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ verify });
    const service = new MailService(createConfig({
      SMTP_HOST: "smtp.timeout-test.host",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: "smtp-user",
      SMTP_PASS: "smtp-pass",
      SMTP_FROM: "no-reply@eventflow.com.br"
    }) as any);

    const result = service.checkTransport();
    jest.advanceTimersByTime(3000);

    await expect(result).resolves.toEqual({
      configured: true,
      reachable: false,
      error: "verification timed out"
    });
    jest.useRealTimers();
  });

  it("caches transport checks for consecutive calls", async () => {
    const verify = jest.fn().mockResolvedValue(true);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ verify });
    const service = new MailService(createConfig({
      SMTP_HOST: "smtp.cache-test.host",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: "smtp-user",
      SMTP_PASS: "smtp-pass",
      SMTP_FROM: "no-reply@eventflow.com.br"
    }) as any);

    await expect(service.checkTransport()).resolves.toEqual({
      configured: true,
      reachable: true
    });
    await expect(service.checkTransport()).resolves.toEqual({
      configured: true,
      reachable: true
    });

    expect(verify).toHaveBeenCalledTimes(1);
  });
});
