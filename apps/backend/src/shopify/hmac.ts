import crypto from "node:crypto";

/**
 * Verifies Shopify's HMAC signature for OAuth callback query params.
 * Shopify signs the query string with the app secret.
 */
export function verifyShopifyOAuthHmac(params: URLSearchParams, apiSecret: string): boolean {
  const provided = params.get("hmac");
  if (!provided) return false;

  const filtered = new URLSearchParams(params);
  filtered.delete("hmac");
  filtered.delete("signature");

  // Sort lexicographically as required by Shopify.
  const message = Array.from(filtered.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const digest = crypto.createHmac("sha256", apiSecret).update(message).digest("hex");

  // Constant-time compare
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verifies Shopify's webhook HMAC header for the raw request body.
 * Header is base64 of HMAC-SHA256(secret, rawBody).
 */
export function verifyShopifyWebhookHmac(
  rawBody: Buffer,
  hmacHeader: string | undefined,
  apiSecret: string
): boolean {
  if (!hmacHeader) return false;
  const computed = crypto
    .createHmac("sha256", apiSecret)
    .update(rawBody)
    .digest("base64");

  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(hmacHeader, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

