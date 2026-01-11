"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.beginInstall = beginInstall;
exports.oauthCallback = oauthCallback;
const node_crypto_1 = __importDefault(require("node:crypto"));
const env_1 = require("../../config/env");
const logger_1 = require("../../config/logger");
const shopDomain_1 = require("../../shopify/shopDomain");
const hmac_1 = require("../../shopify/hmac");
const crypto_1 = require("../../utils/crypto");
const merchants_repo_1 = require("../merchants/merchants.repo");
const OAUTH_STATE_COOKIE = "bundlecart_oauth_state";
function buildAuthorizeUrl(input) {
    const redirectUri = new URL("/api/shopify/auth/callback", env_1.env.APP_URL).toString();
    const scopes = env_1.env.SHOPIFY_SCOPES;
    const url = new URL(`https://${input.shop}/admin/oauth/authorize`);
    url.searchParams.set("client_id", env_1.env.SHOPIFY_API_KEY);
    url.searchParams.set("scope", scopes);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", input.state);
    return url.toString();
}
async function exchangeCodeForToken(input) {
    const url = `https://${input.shop}/admin/oauth/access_token`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            client_id: env_1.env.SHOPIFY_API_KEY,
            client_secret: env_1.env.SHOPIFY_API_SECRET,
            code: input.code
        })
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Token exchange failed (${res.status}): ${body}`);
    }
    return (await res.json());
}
async function beginInstall(req, res) {
    const shop = (0, shopDomain_1.normalizeShopDomain)(req.query.shop);
    if (!shop)
        return res.status(400).send("Invalid shop");
    const state = node_crypto_1.default.randomBytes(16).toString("hex");
    res.cookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: "lax",
        secure: env_1.env.NODE_ENV === "production",
        maxAge: 10 * 60 * 1000 // 10 minutes
    });
    const redirect = buildAuthorizeUrl({ shop, state });
    logger_1.logger.info({ shop }, "OAuth install started");
    return res.redirect(redirect);
}
async function oauthCallback(req, res) {
    const shop = (0, shopDomain_1.normalizeShopDomain)(req.query.shop);
    const code = req.query.code;
    const state = req.query.state;
    if (!shop || !code || !state)
        return res.status(400).send("Missing parameters");
    const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
    if (!cookieState || cookieState !== state) {
        return res.status(400).send("Invalid OAuth state");
    }
    // Verify query HMAC to prevent tampering.
    const fullUrl = new URL(req.originalUrl, env_1.env.APP_URL);
    const hmacOk = (0, hmac_1.verifyShopifyOAuthHmac)(fullUrl.searchParams, env_1.env.SHOPIFY_API_SECRET);
    if (!hmacOk)
        return res.status(401).send("HMAC validation failed");
    const token = await exchangeCodeForToken({ shop, code });
    const enc = (0, crypto_1.encryptString)(token.access_token, env_1.env.ENCRYPTION_KEY_BASE64);
    await (0, merchants_repo_1.upsertMerchant)({
        shopDomain: shop,
        shopId: null, // can be populated later via Shopify API call
        accessTokenCiphertext: enc.ciphertextB64,
        accessTokenIv: enc.ivB64,
        accessTokenTag: enc.tagB64,
        scopes: token.scope
    });
    res.clearCookie(OAUTH_STATE_COOKIE);
    logger_1.logger.info({ shop }, "OAuth install completed");
    // For now, just confirm install. Next steps will add embedded admin + webhook registration.
    return res.status(200).send("BundleCart installed. You can close this window.");
}
