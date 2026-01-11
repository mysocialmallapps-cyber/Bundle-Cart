import type { Request, Response } from "express";
import crypto from "node:crypto";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { normalizeShopDomain } from "../../shopify/shopDomain";
import { verifyShopifyOAuthHmac } from "../../shopify/hmac";
import { encryptString } from "../../utils/crypto";
import { upsertMerchant } from "../merchants/merchants.repo";

const OAUTH_STATE_COOKIE = "bundlecart_oauth_state";

function buildAuthorizeUrl(input: {
  shop: string;
  state: string;
}): string {
  const redirectUri = new URL("/api/shopify/auth/callback", env.APP_URL).toString();
  const scopes = env.SHOPIFY_SCOPES;

  const url = new URL(`https://${input.shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", env.SHOPIFY_API_KEY);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}

async function exchangeCodeForToken(input: {
  shop: string;
  code: string;
}): Promise<{ access_token: string; scope: string }> {
  const url = `https://${input.shop}/admin/oauth/access_token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.SHOPIFY_API_KEY,
      client_secret: env.SHOPIFY_API_SECRET,
      code: input.code
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }
  return (await res.json()) as { access_token: string; scope: string };
}

export async function beginInstall(req: Request, res: Response) {
  const shop = normalizeShopDomain(req.query.shop as string | undefined);
  if (!shop) return res.status(400).send("Invalid shop");

  const state = crypto.randomBytes(16).toString("hex");

  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000 // 10 minutes
  });

  const redirect = buildAuthorizeUrl({ shop, state });
  logger.info({ shop }, "OAuth install started");
  return res.redirect(redirect);
}

export async function oauthCallback(req: Request, res: Response) {
  const shop = normalizeShopDomain(req.query.shop as string | undefined);
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  if (!shop || !code || !state) return res.status(400).send("Missing parameters");

  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;
  if (!cookieState || cookieState !== state) {
    return res.status(400).send("Invalid OAuth state");
  }

  // Verify query HMAC to prevent tampering.
  const fullUrl = new URL(req.originalUrl, env.APP_URL);
  const hmacOk = verifyShopifyOAuthHmac(fullUrl.searchParams, env.SHOPIFY_API_SECRET);
  if (!hmacOk) return res.status(401).send("HMAC validation failed");

  const token = await exchangeCodeForToken({ shop, code });
  const enc = encryptString(token.access_token, env.ENCRYPTION_KEY_BASE64);

  await upsertMerchant({
    shopDomain: shop,
    shopId: null, // can be populated later via Shopify API call
    accessTokenCiphertext: enc.ciphertextB64,
    accessTokenIv: enc.ivB64,
    accessTokenTag: enc.tagB64,
    scopes: token.scope
  });

  res.clearCookie(OAUTH_STATE_COOKIE);
  logger.info({ shop }, "OAuth install completed");

  // For now, just confirm install. Next steps will add embedded admin + webhook registration.
  return res.status(200).send("BundleCart installed. You can close this window.");
}

