import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),

  // Shopify
  SHOPIFY_API_KEY: z.string().min(1),
  SHOPIFY_API_SECRET: z.string().min(1),
  SHOPIFY_SCOPES: z.string().default("read_orders,write_webhooks"),
  APP_URL: z.string().url(), // public https URL in production

  /**
   * 32-byte base64 key for encrypting merchant access tokens at rest.
   * Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   */
  ENCRYPTION_KEY_BASE64: z.string().min(1),

  LOG_LEVEL: z.string().default("info")
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

