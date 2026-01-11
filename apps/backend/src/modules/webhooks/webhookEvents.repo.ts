import { pool } from "../../db/pool";

export type WebhookInsertResult =
  | { inserted: true; id: string }
  | { inserted: false };

export async function insertWebhookEventIfNew(input: {
  merchantId: string | null;
  shopDomain: string;
  topic: string;
  shopifyWebhookId: string;
  hmacValid: boolean;
  payload: unknown;
}): Promise<WebhookInsertResult> {
  const res = await pool.query<{ id: string }>(
    `
      INSERT INTO webhook_events (
        merchant_id,
        shop_domain,
        topic,
        shopify_webhook_id,
        hmac_valid,
        status,
        payload
      )
      VALUES ($1, $2, $3, $4, $5, 'received', $6::jsonb)
      ON CONFLICT (shopify_webhook_id) DO NOTHING
      RETURNING id
    `,
    [
      input.merchantId,
      input.shopDomain,
      input.topic,
      input.shopifyWebhookId,
      input.hmacValid,
      JSON.stringify(input.payload)
    ]
  );

  if (res.rowCount === 1) return { inserted: true, id: res.rows[0]!.id };
  return { inserted: false };
}

export async function markWebhookProcessed(input: {
  id: string;
  status: "processed" | "ignored" | "failed";
  error?: string | null;
}): Promise<void> {
  await pool.query(
    `
      UPDATE webhook_events
      SET status = $2, error = $3, processed_at = NOW()
      WHERE id = $1
    `,
    [input.id, input.status, input.error ?? null]
  );
}

