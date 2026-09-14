import { envSchema } from "./env.schema";

const strongSecrets = {
  JWT_ACCESS_SECRET: "production-access-secret-with-more-than-32-chars",
  JWT_REFRESH_SECRET: "production-refresh-secret-with-more-than-32-chars",
  JWT_RESET_SECRET: "production-reset-secret-with-more-than-32-chars",
  QR_CODE_SECRET: "production-qrcode-secret-with-more-than-32-chars"
};

const strongMail = {
  SMTP_HOST: "smtp.mailtrap.io",
  SMTP_PORT: "587",
  SMTP_USER: "smtp-user",
  SMTP_PASS: "smtp-pass",
  SMTP_FROM: "no-reply@eventflow.com.br"
};

const strongStorage = {
  AWS_ACCESS_KEY_ID: "storage-access-key",
  AWS_SECRET_ACCESS_KEY: "storage-secret-key",
  AWS_S3_ASSETS_BUCKET: "eventflow-assets-prod",
  AWS_S3_ASSETS_PUBLIC_URL: "https://assets.example.com"
};

function baseEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    DATABASE_URL: "postgresql://eventflow:eventflow@localhost:5432/eventflow",
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
      SMTP_REQUIRED: "true",
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

  it("rejects production config when S3 credentials are missing", () => {
    expect(() => envSchema.parse(baseEnv({
      NODE_ENV: "production",
      ...strongSecrets,
      ...strongMail,
      AWS_S3_ASSETS_BUCKET: "eventflow-assets-prod",
      AWS_S3_ASSETS_PUBLIC_URL: "https://assets.example.com"
    }))).toThrow(/AWS_ACCESS_KEY_ID/);
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

  it("rejects production SMTP host placeholders", () => {
    expect(() => envSchema.parse(baseEnv({
      NODE_ENV: "production",
      ...strongSecrets,
      ...strongMail,
      ...strongStorage,
      SMTP_REQUIRED: "true",
      SMTP_HOST: "placeholder.smtp.local"
    }))).toThrow(/SMTP_HOST.*placeholder\.smtp\.local/);
  });

  it("rejects production SMTP_FROM placeholder domains", () => {
    expect(() => envSchema.parse(baseEnv({
      NODE_ENV: "production",
      ...strongSecrets,
      ...strongMail,
      ...strongStorage,
      SMTP_REQUIRED: "true",
      SMTP_FROM: "no-reply@example.com"
    }))).toThrow(/SMTP_FROM.*example\.com/);
  });

  it("allows production to run with mail disabled when SMTP is not required", () => {
    const env = envSchema.parse(baseEnv({
      NODE_ENV: "production",
      ...strongSecrets,
      ...strongStorage,
      SMTP_REQUIRED: "false"
    }));

    expect(env.SMTP_REQUIRED).toBe(false);
  });

  it("allows development SMTP placeholders", () => {
    expect(() => envSchema.parse(baseEnv({
      NODE_ENV: "development",
      SMTP_HOST: "placeholder.smtp.local",
      SMTP_PORT: "587",
      SMTP_USER: "smtp-user",
      SMTP_PASS: "smtp-pass",
      SMTP_FROM: "no-reply@example.com"
    }))).not.toThrow();
  });

  it("accepts Cloudflare R2-compatible storage settings", () => {
    const env = envSchema.parse(baseEnv({
      NODE_ENV: "production",
      ...strongSecrets,
      ...strongMail,
      ...strongStorage,
      AWS_REGION: "auto",
      AWS_S3_ENDPOINT: "https://example-account.r2.cloudflarestorage.com",
      AWS_S3_FORCE_PATH_STYLE: "true"
    }));

    expect(env.AWS_REGION).toBe("auto");
    expect(env.AWS_S3_ENDPOINT).toBe("https://example-account.r2.cloudflarestorage.com");
    expect(env.AWS_S3_FORCE_PATH_STYLE).toBe(true);
  });
});

describe("envSchema boolean flags", () => {
  // Environment variables are strings. These tests use the exact strings a
  // hosting panel produces, because that is where the bug lived.
  it('reads the string "false" as false', () => {
    const parsed = envSchema.parse(
      baseEnv({
        PAYMENT_SIMULATION_ENABLED: "false",
        PURCHASE_EMAIL_ENABLED: "false",
        QUEUE_WORKERS_ENABLED: "false",
        SMTP_SECURE: "false",
        OTEL_ENABLED: "false",
        AWS_S3_FORCE_PATH_STYLE: "false"
      })
    );

    expect(parsed.PAYMENT_SIMULATION_ENABLED).toBe(false);
    expect(parsed.PURCHASE_EMAIL_ENABLED).toBe(false);
    expect(parsed.QUEUE_WORKERS_ENABLED).toBe(false);
    expect(parsed.SMTP_SECURE).toBe(false);
    expect(parsed.OTEL_ENABLED).toBe(false);
    expect(parsed.AWS_S3_FORCE_PATH_STYLE).toBe(false);
  });

  it('reads the string "true" as true', () => {
    const parsed = envSchema.parse(
      baseEnv({ PAYMENT_SIMULATION_ENABLED: "true", PURCHASE_EMAIL_ENABLED: "true" })
    );

    expect(parsed.PAYMENT_SIMULATION_ENABLED).toBe(true);
    expect(parsed.PURCHASE_EMAIL_ENABLED).toBe(true);
  });

  it('reads "0" and "off" as false', () => {
    const parsed = envSchema.parse(
      baseEnv({ PAYMENT_SIMULATION_ENABLED: "0", PURCHASE_EMAIL_ENABLED: "off" })
    );

    expect(parsed.PAYMENT_SIMULATION_ENABLED).toBe(false);
    expect(parsed.PURCHASE_EMAIL_ENABLED).toBe(false);
  });

  it("keeps the payment simulation off when the flag is absent", () => {
    expect(envSchema.parse(baseEnv()).PAYMENT_SIMULATION_ENABLED).toBe(false);
  });

  it("keeps the purchase e-mail on when the flag is absent", () => {
    expect(envSchema.parse(baseEnv()).PURCHASE_EMAIL_ENABLED).toBe(true);
  });

  it("refuses an ambiguous value instead of guessing", () => {
    expect(() => envSchema.parse(baseEnv({ PAYMENT_SIMULATION_ENABLED: "talvez" }))).toThrow();
  });
});

describe("envSchema payment simulation guard", () => {
  function productionEnv(overrides: Record<string, string | undefined> = {}) {
    return baseEnv({
      NODE_ENV: "production",
      ...strongSecrets,
      ...strongMail,
      ...strongStorage,
      ...overrides
    });
  }

  it("refuses to boot in production with the payment simulation on", () => {
    expect(() => envSchema.parse(productionEnv({ PAYMENT_SIMULATION_ENABLED: "true" }))).toThrow(
      /PAYMENT_SIMULATION_ENABLED must be false in production/
    );
  });

  it("boots in production with the payment simulation off", () => {
    expect(() =>
      envSchema.parse(productionEnv({ PAYMENT_SIMULATION_ENABLED: "false" }))
    ).not.toThrow();
  });

  it("boots in production when the flag is absent", () => {
    expect(() => envSchema.parse(productionEnv())).not.toThrow();
  });

  it("still allows the simulation outside production", () => {
    const parsed = envSchema.parse(
      baseEnv({ NODE_ENV: "development", PAYMENT_SIMULATION_ENABLED: "true" })
    );
    expect(parsed.PAYMENT_SIMULATION_ENABLED).toBe(true);
  });
});
