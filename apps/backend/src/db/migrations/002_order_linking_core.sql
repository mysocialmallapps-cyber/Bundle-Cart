-- BundleCart order linking core
-- Customers are email-based and global (cross-merchant).

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A link group represents a 24-hour eligibility window anchored on the first order.
CREATE TABLE IF NOT EXISTS link_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT link_groups_window_valid CHECK (window_end > window_start)
);

CREATE INDEX IF NOT EXISTS link_groups_customer_window_start_idx
  ON link_groups (customer_id, window_start DESC);

CREATE INDEX IF NOT EXISTS link_groups_customer_window_end_idx
  ON link_groups (customer_id, window_end DESC);

-- Orders are stored per-merchant, but linking is customer-global.
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  shopify_order_id BIGINT NOT NULL,
  order_number TEXT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  email_snapshot TEXT NOT NULL,
  placed_at TIMESTAMPTZ NOT NULL,
  link_group_id UUID REFERENCES link_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_shopify_order_id_positive CHECK (shopify_order_id > 0)
);

-- Idempotency: a Shopify order ID is unique within a merchant/shop.
CREATE UNIQUE INDEX IF NOT EXISTS orders_merchant_shopify_order_id_uq
  ON orders (merchant_id, shopify_order_id);

CREATE INDEX IF NOT EXISTS orders_customer_placed_at_idx
  ON orders (customer_id, placed_at DESC);

CREATE INDEX IF NOT EXISTS orders_link_group_id_idx
  ON orders (link_group_id);

