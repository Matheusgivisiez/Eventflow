import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_READ_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(16).default("change-me-access-secret"),
  JWT_REFRESH_SECRET: z.string().min(16).default("change-me-refresh-secret"),
  JWT_RESET_SECRET: z.string().min(16).default("change-me-reset-secret"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:3001"),
  PORT: z.coerce.number().default(3001),
  MERCADO_PAGO_ACCESS_TOKEN: z.string().optional(),
  QR_CODE_SECRET: z.string().min(16).default("change-me-qrcode-secret"),
  RABBITMQ_URL: z.string().url().default("amqp://eventhub:eventhub@localhost:5672"),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_S3_ASSETS_BUCKET: z.string().optional(),
  AWS_S3_BACKUPS_BUCKET: z.string().optional(),
  CLOUDFRONT_DISTRIBUTION_ID: z.string().optional(),
  ENCRYPTION_KEY_REF: z.string().optional(),
  GOOGLE_ANALYTICS_MEASUREMENT_ID: z.string().optional(),
  META_PIXEL_ID: z.string().optional(),
  OTEL_ENABLED: z.coerce.boolean().default(false)
});
