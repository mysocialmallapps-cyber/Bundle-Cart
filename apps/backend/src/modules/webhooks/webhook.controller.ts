import type { Request, Response } from "express";
import { env } from "../../config/env";
import { verifyShopifyWebhookHmac } from "../../shopify/hmac";
import { normalizeShopDomain } from "../../shopify/shopDomain";
import { findMerchantByShopDomain, markMerchantUninstalled } from "../merchants/merchants.repo";
import {
  insertWebhookEventIfNew,
  markWebhookProcessed
} from "./webhookEvents.repo";
import { handleOrdersCreate } from "./handlers/orders_create";

type ShopifyWebhookHeaders = {
  topic?: string;
  shopDomain?: string;
  webhookId?: string;
  hmac?: string;
};

function readShopifyHeaders(req: Request): ShopifyWebhookHeaders {
  return {
    topic: req.header("x-shopify-topic") ?? undefined,
    shopDomain: req.header("x-shopify-shop-domain") ?? undefined,
    webhookId: req.header("x-shopify-webhook-id") ?? undefined,
    hmac: req.header("x-shopify-hmac-sha256") ?? undefined
  };
}

export async function webhookReceiver(req: Request, res: Response) {
  // Note: this route uses `express.raw({ type: 'application/json' })` middleware.
  const rawBody = req.body as Buffer;
  const headers = readShopifyHeaders(req);

  const shopDomain = normalizeShopDomain(headers.shopDomain);
  if (!shopDomain || !headers.topic || !headers.webhookId) {
    // Bad requests should not be retried forever; respond 400.
    return res.status(400).send("Missing required Shopify webhook headers");
  }

  const hmacValid = verifyShopifyWebhookHmac(
    rawBody,
    headers.hmac,
    env.SHOPIFY_API_SECRET
  );

  if (!hmacValid) {
    // If HMAC fails we must reject the webhook (do not process).
    req.log?.warn?.({ shopDomain, topic: headers.topic }, "Webhook HMAC invalid");
    return res.status(401).send("Invalid webhook HMAC");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid JSON body");
  }

  const merchant = await findMerchantByShopDomain(shopDomain);
  const insert = await insertWebhookEventIfNew({
    merchantId: merchant?.id ?? null,
    shopDomain,
    topic: headers.topic,
    shopifyWebhookId: headers.webhookId,
    hmacValid: true,
    payload
  });

  if (!insert.inserted) {
    // Idempotency: already processed/received this webhook id.
    req.log?.info?.(
      { shopDomain, topic: headers.topic, webhookId: headers.webhookId },
      "Duplicate webhook ignored"
    );
    return res.status(200).send("ok");
  }

  try {
    switch (headers.topic) {
      case "app/uninstalled": {
        await markMerchantUninstalled(shopDomain);
        await markWebhookProcessed({ id: insert.id, status: "processed" });
        req.log?.info?.({ shopDomain }, "App uninstalled webhook processed");
        break;
      }
      case "orders/create": {
        await handleOrdersCreate({
          logger: req.log,
          merchantId: merchant?.id ?? null,
          shopDomain,
          payload
        });
        await markWebhookProcessed({ id: insert.id, status: "processed" });
        break;
      }
      default: {
        await markWebhookProcessed({ id: insert.id, status: "ignored" });
        req.log?.info?.({ shopDomain, topic: headers.topic }, "Webhook topic ignored");
      }
    }

    return res.status(200).send("ok");
  } catch (err: any) {
    await markWebhookProcessed({
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

