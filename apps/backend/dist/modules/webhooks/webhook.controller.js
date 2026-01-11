"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookReceiver = webhookReceiver;
const env_1 = require("../../config/env");
const hmac_1 = require("../../shopify/hmac");
const shopDomain_1 = require("../../shopify/shopDomain");
const merchants_repo_1 = require("../merchants/merchants.repo");
const webhookEvents_repo_1 = require("./webhookEvents.repo");
function readShopifyHeaders(req) {
    return {
        topic: req.header("x-shopify-topic") ?? undefined,
        shopDomain: req.header("x-shopify-shop-domain") ?? undefined,
        webhookId: req.header("x-shopify-webhook-id") ?? undefined,
        hmac: req.header("x-shopify-hmac-sha256") ?? undefined
    };
}
async function webhookReceiver(req, res) {
    // Note: this route uses `express.raw({ type: 'application/json' })` middleware.
    const rawBody = req.body;
    const headers = readShopifyHeaders(req);
    const shopDomain = (0, shopDomain_1.normalizeShopDomain)(headers.shopDomain);
    if (!shopDomain || !headers.topic || !headers.webhookId) {
        // Bad requests should not be retried forever; respond 400.
        return res.status(400).send("Missing required Shopify webhook headers");
    }
    const hmacValid = (0, hmac_1.verifyShopifyWebhookHmac)(rawBody, headers.hmac, env_1.env.SHOPIFY_API_SECRET);
    if (!hmacValid) {
        // If HMAC fails we must reject the webhook (do not process).
        req.log?.warn?.({ shopDomain, topic: headers.topic }, "Webhook HMAC invalid");
        return res.status(401).send("Invalid webhook HMAC");
    }
    let payload;
    try {
        payload = JSON.parse(rawBody.toString("utf8"));
    }
    catch {
        return res.status(400).send("Invalid JSON body");
    }
    const merchant = await (0, merchants_repo_1.findMerchantByShopDomain)(shopDomain);
    const insert = await (0, webhookEvents_repo_1.insertWebhookEventIfNew)({
        merchantId: merchant?.id ?? null,
        shopDomain,
        topic: headers.topic,
        shopifyWebhookId: headers.webhookId,
        hmacValid: true,
        payload
    });
    if (!insert.inserted) {
        // Idempotency: already processed/received this webhook id.
        req.log?.info?.({ shopDomain, topic: headers.topic, webhookId: headers.webhookId }, "Duplicate webhook ignored");
        return res.status(200).send("ok");
    }
    try {
        switch (headers.topic) {
            case "app/uninstalled": {
                await (0, merchants_repo_1.markMerchantUninstalled)(shopDomain);
                await (0, webhookEvents_repo_1.markWebhookProcessed)({ id: insert.id, status: "processed" });
                req.log?.info?.({ shopDomain }, "App uninstalled webhook processed");
                break;
            }
            case "orders/create": {
                // Linking logic will be implemented next. For now we only persist the webhook event.
                await (0, webhookEvents_repo_1.markWebhookProcessed)({ id: insert.id, status: "processed" });
                req.log?.info?.({ shopDomain }, "orders/create webhook received");
                break;
            }
            default: {
                await (0, webhookEvents_repo_1.markWebhookProcessed)({ id: insert.id, status: "ignored" });
                req.log?.info?.({ shopDomain, topic: headers.topic }, "Webhook topic ignored");
            }
        }
        return res.status(200).send("ok");
    }
    catch (err) {
        await (0, webhookEvents_repo_1.markWebhookProcessed)({
            id: insert.id,
            status: "failed",
            error: err?.message ?? "Unknown error"
        });
        req.log?.error?.({ err, shopDomain, topic: headers.topic }, "Webhook processing failed");
        // Return 200 to avoid retry storms; webhook is recorded for investigation.
        // (Shopify may retry on non-2xx, but we prefer not to amplify failures.)
        return res.status(200).send("ok");
    }
}
