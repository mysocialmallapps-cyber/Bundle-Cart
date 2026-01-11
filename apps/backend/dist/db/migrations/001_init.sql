-- BundleCart initial schema (foundation for OAuth + webhooks)
-- Notes:
-- - We use `citext` for email normalization later; enabling extension now is safe.
-- - Access tokens are encrypted at rest by the application layer (AES-256-GCM).

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain TEXT NOT NULL UNIQUE,
  shop_id BIGINT UNIQUE,
  access_token_ciphertext TEXT NOT NULL,
  access_token_iv TEXT NOT NULL,
  access_token_tag TEXT NOT NULL,
  scopes TEXT NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uninstalled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook deliveries are de-duped using `X-Shopify-Webhook-Id`.
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  shop_domain TEXT NOT NULL,
  topic TEXT NOT NULL,
  shopify_webhook_id TEXT NOT NULL,
  hmac_valid BOOLEAN NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'received',
  error TEXT,
  payload JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_shopify_webhook_id_uq
  ON webhook_events (shopify_webhook_id);

CREATE INDEX IF NOT EXISTS webhook_events_shop_domain_received_at_idx
  ON webhook_events (shop_domain, received_at DESC);

CREATE INDEX IF NOT EXISTS webhook_events_topic_received_at_idx
  ON webhook_events (topic, received_at DESC);

