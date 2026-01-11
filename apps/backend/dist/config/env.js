"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    PORT: zod_1.z.coerce.number().int().positive().default(3000),
    DATABASE_URL: zod_1.z.string().min(1),
    // Shopify
    SHOPIFY_API_KEY: zod_1.z.string().min(1),
    SHOPIFY_API_SECRET: zod_1.z.string().min(1),
    SHOPIFY_SCOPES: zod_1.z.string().default("read_orders,write_webhooks"),
    APP_URL: zod_1.z.string().url(), // public https URL in production
    /**
     * 32-byte base64 key for encrypting merchant access tokens at rest.
     * Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
     */
    ENCRYPTION_KEY_BASE64: zod_1.z.string().min(1),
    LOG_LEVEL: zod_1.z.string().default("info")
});
exports.env = envSchema.parse(process.env);
