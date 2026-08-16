import { envSchema } from "./env.schema";

const strongSecrets = {
  JWT_ACCESS_SECRET: "production-access-secret-with-more-than-32-chars",
  JWT_REFRESH_SECRET: "production-refresh-secret-with-more-than-32-chars",
  JWT_RESET_SECRET: "production-reset-secret-with-more-than-32-chars",
  QR_CODE_SECRET: "production-qrcode-secret-with-more-than-32-chars"
};

const strongMail = {
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_USER: "smtp-user",
  SMTP_PASS: "smtp-pass",
  SMTP_FROM: "no-reply@example.com"
};

const strongStorage = {
  AWS_S3_ASSETS_BUCKET: "eventhub-assets-prod",
  AWS_S3_ASSETS_PUBLIC_URL: "https://assets.example.com"
};

function baseEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    DATABASE_URL: "postgresql://eventhub:eventhub@localhost:5432/eventhub",
    ...overrides
  };
}

describe("envSchema", () => {
  it("provides development-only defaults outside production", () => {
    const env = envSchema.parse(baseEnv());

    expect(env.NODE_ENV).toBe("development");
    expect(env.JWT_ACCESS_SECRET).toBe("dev-only-access-secret-32-chars-minimum");
    expect(env.JWT_REFRESH_SECRET).toBe("dev-only-refresh-secret-32-chars-minimum");
    expect(env.JWT_RESET_SECRET).toBe("dev-only-reset-secret-32-chars-minimum");
    expect(env.QR_CODE_SECRET).toBe("dev-only-qrcode-secret-32-chars-minimum");
  });

  it("rejects production config when required secrets are missing", () => {
    expect(() => envSchema.parse(baseEnv({ NODE_ENV: "production" }))).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("rejects known weak production secrets", () => {
    expect(() => envSchema.parse(baseEnv({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "change-me-access-secret",
      JWT_REFRESH_SECRET: strongSecrets.JWT_REFRESH_SECRET,
      JWT_RESET_SECRET: strongSecrets.JWT_RESET_SECRET,
      QR_CODE_SECRET: strongSecrets.QR_CODE_SECRET,
      ...strongMail,
      ...strongStorage
    }))).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("rejects production config when SMTP settings are missing", () => {
    expect(() => envSchema.parse(baseEnv({
      NODE_ENV: "production",
      ...strongSecrets,
      ...strongStorage
    }))).toThrow(/SMTP_HOST/);
  });

  it("rejects production config when external asset storage is missing", () => {
    expect(() => envSchema.parse(baseEnv({
      NODE_ENV: "production",
      ...strongSecrets,
      ...strongMail
    }))).toThrow(/AWS_S3_ASSETS_BUCKET/);
  });

  it("accepts strong production secrets", () => {
    const env = envSchema.parse(baseEnv({
      NODE_ENV: "production",
      ...strongSecrets,
      ...strongMail,
      ...strongStorage
    }));

    expect(env.JWT_ACCESS_SECRET).toBe(strongSecrets.JWT_ACCESS_SECRET);
    expect(env.QR_CODE_SECRET).toBe(strongSecrets.QR_CODE_SECRET);
    expect(env.SMTP_FROM).toBe(strongMail.SMTP_FROM);
    expect(env.AWS_S3_ASSETS_PUBLIC_URL).toBe(strongStorage.AWS_S3_ASSETS_PUBLIC_URL);
  });
});
