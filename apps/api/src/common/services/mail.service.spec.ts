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
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: "smtp-user",
      SMTP_PASS: "smtp-pass",
      SMTP_FROM: "no-reply@example.com"
    });
    const service = new MailService(config as any);

    const result = await service.send({
      to: "user@example.com",
      subject: "Reset",
      text: "Reset link",
      html: "<p>Reset link</p>"
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: {
        user: "smtp-user",
        pass: "smtp-pass"
      }
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: "no-reply@example.com",
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
});
