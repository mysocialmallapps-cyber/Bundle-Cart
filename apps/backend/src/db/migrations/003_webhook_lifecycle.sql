-- Webhook lifecycle management:
-- - store webhook registration metadata (optional but useful for ops/debug)
-- - allow invalidating access tokens on uninstall

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS access_token_invalidated_at TIMESTAMPTZ;

-- Allow token fields to be nulled on uninstall (invalidate in DB).
ALTER TABLE merchants
  ALTER COLUMN access_token_ciphertext DROP NOT NULL,
  ALTER COLUMN access_token_iv DROP NOT NULL,
  ALTER COLUMN access_token_tag DROP NOT NULL;

CREATE TABLE IF NOT EXISTS merchant_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  shopify_webhook_id BIGINT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT merchant_webhooks_merchant_topic_uq UNIQUE (merchant_id, topic)
);

CREATE INDEX IF NOT EXISTS merchant_webhooks_merchant_id_idx
  ON merchant_webhooks (merchant_id);

