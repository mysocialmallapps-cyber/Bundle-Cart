import { env } from "../../config/env";
import { shopifyRestRequest } from "../../shopify/adminRest";
import { upsertMerchantWebhook } from "./merchantWebhooks.repo";

type LoggerLike = {
  info?: (obj: any, msg?: string) => void;
  warn?: (obj: any, msg?: string) => void;
  error?: (obj: any, msg?: string) => void;
};

type ShopifyWebhook = {
  id: number;
  address: string;
  topic: string;
  format: string;
};

type ShopifyWebhooksListResponse = { webhooks: ShopifyWebhook[] };
type ShopifyWebhookCreateResponse = { webhook: ShopifyWebhook };
type ShopifyWebhookUpdateResponse = { webhook: ShopifyWebhook };

function webhookAddress(): string {
  return new URL("/api/webhooks", env.APP_URL).toString();
}

async function ensureWebhook(input: {
  shopDomain: string;
  accessToken: string;
  merchantId: string;
  topic: "orders/create" | "app/uninstalled";
  logger?: LoggerLike;
}): Promise<void> {
  const address = webhookAddress();
  const list = await shopifyRestRequest<ShopifyWebhooksListResponse>({
    shopDomain: input.shopDomain,
    accessToken: input.accessToken,
    method: "GET",
    path: `/webhooks.json?topic=${encodeURIComponent(input.topic)}`
  });

  const existing = list.webhooks.find((w) => w.topic === input.topic);

  if (!existing) {
    const created = await shopifyRestRequest<ShopifyWebhookCreateResponse>({
      shopDomain: input.shopDomain,
      accessToken: input.accessToken,
      method: "POST",
      path: "/webhooks.json",
      body: {
        webhook: {
          topic: input.topic,
          address,
          format: "json"
        }
      }
    });
    input.logger?.info?.({ topic: input.topic, webhookId: created.webhook.id }, "Webhook created");
    await upsertMerchantWebhook({
      merchantId: input.merchantId,
      topic: input.topic,
      shopifyWebhookId: created.webhook.id,
      address: created.webhook.address
    });
    return;
  }

  if (existing.address !== address) {
    const updated = await shopifyRestRequest<ShopifyWebhookUpdateResponse>({
      shopDomain: input.shopDomain,
      accessToken: input.accessToken,
      method: "PUT",
      path: `/webhooks/${existing.id}.json`,
      body: {
        webhook: {
          id: existing.id,
          address,
          format: "json"
        }
      }
    });
    input.logger?.info?.({ topic: input.topic, webhookId: updated.webhook.id }, "Webhook updated");
    await upsertMerchantWebhook({
      merchantId: input.merchantId,
      topic: input.topic,
      shopifyWebhookId: updated.webhook.id,
      address: updated.webhook.address
    });
    return;
  }

  // Already correct; still upsert metadata for observability.
  await upsertMerchantWebhook({
    merchantId: input.merchantId,
    topic: input.topic,
    shopifyWebhookId: existing.id,
    address: existing.address
  });
  input.logger?.info?.({ topic: input.topic, webhookId: existing.id }, "Webhook already registered");
}

export async function registerRequiredWebhooks(input: {
  shopDomain: string;
  accessToken: string;
  merchantId: string;
  logger?: LoggerLike;
}): Promise<void> {
  // Idempotent: safe to run on every install / re-install.
  await ensureWebhook({ ...input, topic: "orders/create" });
  await ensureWebhook({ ...input, topic: "app/uninstalled" });
}

