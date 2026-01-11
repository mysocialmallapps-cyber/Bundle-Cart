"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyShopifyOAuthHmac = verifyShopifyOAuthHmac;
exports.verifyShopifyWebhookHmac = verifyShopifyWebhookHmac;
const node_crypto_1 = __importDefault(require("node:crypto"));
/**
 * Verifies Shopify's HMAC signature for OAuth callback query params.
 * Shopify signs the query string with the app secret.
 */
function verifyShopifyOAuthHmac(params, apiSecret) {
    const provided = params.get("hmac");
    if (!provided)
        return false;
    const filtered = new URLSearchParams(params);
    filtered.delete("hmac");
    filtered.delete("signature");
    // Sort lexicographically as required by Shopify.
    const message = Array.from(filtered.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&");
    const digest = node_crypto_1.default.createHmac("sha256", apiSecret).update(message).digest("hex");
    // Constant-time compare
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length)
        return false;
    return node_crypto_1.default.timingSafeEqual(a, b);
}
/**
 * Verifies Shopify's webhook HMAC header for the raw request body.
 * Header is base64 of HMAC-SHA256(secret, rawBody).
 */
function verifyShopifyWebhookHmac(rawBody, hmacHeader, apiSecret) {
    if (!hmacHeader)
        return false;
    const computed = node_crypto_1.default
        .createHmac("sha256", apiSecret)
        .update(rawBody)
        .digest("base64");
    const a = Buffer.from(computed, "utf8");
    const b = Buffer.from(hmacHeader, "utf8");
    if (a.length !== b.length)
        return false;
    return node_crypto_1.default.timingSafeEqual(a, b);
}
