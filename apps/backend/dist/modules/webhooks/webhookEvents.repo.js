"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertWebhookEventIfNew = insertWebhookEventIfNew;
exports.markWebhookProcessed = markWebhookProcessed;
const pool_1 = require("../../db/pool");
async function insertWebhookEventIfNew(input) {
    const res = await pool_1.pool.query(`
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
    `, [
        input.merchantId,
        input.shopDomain,
        input.topic,
        input.shopifyWebhookId,
        input.hmacValid,
        JSON.stringify(input.payload)
    ]);
    if (res.rowCount === 1)
        return { inserted: true, id: res.rows[0].id };
    return { inserted: false };
}
async function markWebhookProcessed(input) {
    await pool_1.pool.query(`
      UPDATE webhook_events
      SET status = $2, error = $3, processed_at = NOW()
      WHERE id = $1
    `, [input.id, input.status, input.error ?? null]);
}
