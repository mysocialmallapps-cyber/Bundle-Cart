import { pool } from "../../db/pool";

export async function upsertMerchantWebhook(input: {
  merchantId: string;
  topic: string;
  shopifyWebhookId: number;
  address: string;
}): Promise<void> {
  await pool.query(
    `
      INSERT INTO merchant_webhooks (
        merchant_id,
        topic,
        shopify_webhook_id,
        address,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (merchant_id, topic) DO UPDATE SET
        shopify_webhook_id = EXCLUDED.shopify_webhook_id,
        address = EXCLUDED.address,
        updated_at = NOW()
    `,
    [input.merchantId, input.topic, input.shopifyWebhookId, input.address]
  );
}

