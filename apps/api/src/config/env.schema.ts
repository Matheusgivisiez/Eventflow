import { z } from "zod";

const devSecrets = {
  JWT_ACCESS_SECRET: "dev-only-access-secret-32-chars-minimum",
  JWT_REFRESH_SECRET: "dev-only-refresh-secret-32-chars-minimum",
  JWT_RESET_SECRET: "dev-only-reset-secret-32-chars-minimum",
  QR_CODE_SECRET: "dev-only-qrcode-secret-32-chars-minimum"
};

const weakSecretValues = new Set([
  "change-me-access",
  "change-me-refresh",
  "change-me-access-secret",
  "change-me-refresh-secret",
  "change-me-reset-secret",
  "change-me-qrcode-secret",
  ...Object.values(devSecrets)
]);

const secretKeys = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "JWT_RESET_SECRET", "QR_CODE_SECRET"] as const;
const productionMailKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const;
const productionAssetStorageKeys = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_S3_ASSETS_BUCKET",
  "AWS_S3_ASSETS_PUBLIC_URL"
] as const;

/**
 * Environment variables arrive as strings, and zod's boolean coercion is
 * `Boolean(value)`: every non-empty string — "false", "0", "no" — becomes true.
 * A flag set to "false" in the hosting panel would silently stay on, so parse
 * the words instead and reject anything ambiguous at boot.
 */
const TRUE_VALUES = new Set(["true", "1", "yes", "y", "on"]);
const FALSE_VALUES = new Set(["false", "0", "no", "n", "off", ""]);

function booleanFromEnv(defaultValue: boolean) {
  return z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return defaultValue;
      if (typeof value === "boolean") return value;

      const normalized = value.trim().toLowerCase();
      if (TRUE_VALUES.has(normalized)) return true;
      if (FALSE_VALUES.has(normalized)) return false;

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Valor booleano invalido: "${value}". Use "true" ou "false".`
      });
      return z.NEVER;
    });
}

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  DATABASE_READ_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  QUEUE_WORKERS_ENABLED: booleanFromEnv(false),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_RESET_SECRET: z.string().optional(),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:3001"),
  PORT: z.coerce.number().default(3001),
  ABACATE_API_KEY: z.string().optional(),
  ABACATE_WEBHOOK_SECRET: z.string().optional(),
  ABACATE_BASE_URL: z.string().url().default("https://api.abacatepay.com/v2"),
  ABACATE_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  // A payment bypass must never be on by accident: off unless opted in.
  PAYMENT_SIMULATION_ENABLED: booleanFromEnv(false),
  ORDER_RESERVATION_TTL_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(30),
  ABACATE_PUBLIC_KEY: z.string().optional(),
  ABACATEPAY_API_KEY: z.string().optional(),
  ABACATEPAY_WEBHOOK_SECRET: z.string().optional(),
  ABACATEPAY_BASE_URL: z.string().url().optional(),
  ABACATEPAY_PUBLIC_KEY: z.string().optional(),
  QR_CODE_SECRET: z.string().optional(),
  RABBITMQ_URL: z.string().url().default("amqp://eventflow:eventflow@localhost:5672"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_S3_ENDPOINT: z.string().url().optional(),
  AWS_S3_FORCE_PATH_STYLE: booleanFromEnv(false),
  AWS_S3_ASSETS_BUCKET: z.string().optional(),
  AWS_S3_ASSETS_PUBLIC_URL: z.string().url().optional(),
  AWS_S3_BACKUPS_BUCKET: z.string().optional(),
  CLOUDFRONT_DISTRIBUTION_ID: z.string().optional(),
  ENCRYPTION_KEY_REF: z.string().optional(),
  GOOGLE_ANALYTICS_MEASUREMENT_ID: z.string().optional(),
  META_PIXEL_ID: z.string().optional(),
  // Kill switch for the purchase confirmation e-mail without taking SMTP down
  // (password recovery depends on the same transport).
  PURCHASE_EMAIL_ENABLED: booleanFromEnv(true),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: booleanFromEnv(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  OTEL_ENABLED: booleanFromEnv(false),
  THROTTLE_TTL: z.coerce.number().default(60000),
  THROTTLE_LIMIT: z.coerce.number().default(120)
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== "production") return;

  // The simulation bypasses the payment provider entirely: createCheckout never
  // calls AbacatePay and confirm-simulation turns an order into PAID. Parsing
  // the flag correctly is not enough — production must refuse to boot with it on.
  if (env.PAYMENT_SIMULATION_ENABLED) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PAYMENT_SIMULATION_ENABLED"],
      message: "PAYMENT_SIMULATION_ENABLED must be false in production: it issues tickets without charging."
    });
  }

  for (const key of secretKeys) {
    const value = env[key];
    if (!value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required in production.`
      });
      continue;
    }

    if (value.length < 32 || weakSecretValues.has(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} must be a strong production secret with at least 32 characters.`
      });
    }
  }

  for (const key of productionMailKeys) {
    if (!env[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required in production for password recovery emails.`
      });
    }
  }

  for (const key of productionAssetStorageKeys) {
    if (!env[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required in production for external asset uploads.`
      });
    }
  }
}).transform((env) => ({
  ...env,
  JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET ?? devSecrets.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET ?? devSecrets.JWT_REFRESH_SECRET,
  JWT_RESET_SECRET: env.JWT_RESET_SECRET ?? devSecrets.JWT_RESET_SECRET,
  QR_CODE_SECRET: env.QR_CODE_SECRET ?? devSecrets.QR_CODE_SECRET
}));
