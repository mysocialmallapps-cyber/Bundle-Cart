-- Carrier service + shipping decisions

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS carrier_service_id BIGINT;

CREATE INDEX IF NOT EXISTS merchants_carrier_service_id_idx
  ON merchants (carrier_service_id);

CREATE TABLE IF NOT EXISTS shipping_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL UNIQUE,
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  shop_domain TEXT NOT NULL,
  email TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  link_group_id UUID REFERENCES link_groups(id) ON DELETE SET NULL,
  qualified BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shipping_decisions_email_created_at_idx
  ON shipping_decisions (email, created_at DESC);

CREATE INDEX IF NOT EXISTS shipping_decisions_link_group_created_at_idx
  ON shipping_decisions (link_group_id, created_at DESC);

