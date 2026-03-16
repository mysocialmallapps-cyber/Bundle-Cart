import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { sendEmail } from "./server/services/email.js";

const DIST_PATH = path.resolve("dist");
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "";
const dbPool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;
const SHOPIFY_ADMIN_API_VERSION = "2026-01";
const BUNDLECART_CARRIER_NAME = "BundleCart";
const BUNDLECART_CALLBACK_URL = "https://bundle-cart.replit.app/api/shipping/rates";
const BUNDLECART_PAID_RATE = {
  service_name: "BundleCart",
  service_code: "BUNDLECART_PAID",
  total_price: "500",
  description:
    "Pay shipping once. Add more orders in the next 72 hours with free BundleCart shipping."
};
const BUNDLECART_FREE_RATE = {
  service_name: "BundleCart",
  service_code: "BUNDLECART_FREE",
  total_price: "0",
  description:
    "Your active BundleCart window is open. Linked orders in the next 72 hours ship free together."
};
const BUNDLECART_EMAIL_WORKER_INTERVAL_MS = 10 * 60 * 1000;
const BUNDLECART_EMAIL_WORKER_BATCH_LIMIT = 100;
const SHOPIFY_BILLING_MODE = String(process.env.SHOPIFY_BILLING_MODE || "manual")
  .trim()
  .toLowerCase();
const SHOPIFY_BILLING_TEST_MODE = ["1", "true", "yes", "on"].includes(
  String(process.env.SHOPIFY_BILLING_TEST_MODE || "")
    .trim()
    .toLowerCase()
);
const SHOPIFY_BILLING_PLAN_NAME = String(
  process.env.SHOPIFY_BILLING_PLAN_NAME || "BundleCart Network Billing"
).trim();
const SHOPIFY_BILLING_USAGE_CAP_AMOUNT = Number.parseFloat(
  String(process.env.SHOPIFY_BILLING_USAGE_CAP_AMOUNT || "1000")
);
const SHOPIFY_BILLING_BASE_PLAN_AMOUNT = Number.parseFloat(
  String(process.env.SHOPIFY_BILLING_BASE_PLAN_AMOUNT || "0")
);

const CREATE_SHOPIFY_ORDERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS shopify_orders (
  id SERIAL PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  shopify_order_id BIGINT NOT NULL,
  email TEXT,
  created_at TIMESTAMP,
  total_price NUMERIC,
  currency TEXT,
  webhook_id TEXT UNIQUE,
  raw_payload JSONB,
  inserted_at TIMESTAMP DEFAULT NOW()
);
`;

const CREATE_SHOPIFY_ORDER_UNIQUES_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS shopify_orders_shop_domain_order_id_uq
ON shopify_orders (shop_domain, shopify_order_id);

CREATE UNIQUE INDEX IF NOT EXISTS shopify_orders_webhook_id_uq
ON shopify_orders (webhook_id)
WHERE webhook_id IS NOT NULL;
`;

const CREATE_MERCHANTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS merchants (
  id SERIAL PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_webhook_at TIMESTAMP,
  access_token TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  merchant_country_code TEXT,
  merchant_region TEXT
);
`;

const CREATE_MERCHANTS_DOMAIN_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS merchants_domain_uq ON merchants(domain);
`;

const CREATE_LINK_GROUPS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS link_groups (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  active_until TIMESTAMP,
  address_hash TEXT,
  bundlecart_paid_at TIMESTAMP,
  first_paid_order_id BIGINT,
  first_shop_domain TEXT,
  customer_address_json JSONB,
  reminder_email_sent BOOLEAN DEFAULT FALSE,
  expired_email_sent BOOLEAN DEFAULT FALSE
);
`;

const CREATE_LINKED_ORDERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS linked_orders (
  id SERIAL PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  shopify_order_id BIGINT NOT NULL,
  email TEXT,
  group_id INTEGER REFERENCES link_groups(id) ON DELETE SET NULL,
  bundlecart_selected BOOLEAN DEFAULT FALSE,
  bundlecart_paid BOOLEAN DEFAULT FALSE,
  bundlecart_fee_amount NUMERIC(10,2) DEFAULT 0,
  address_hash TEXT,
  created_at TIMESTAMP,
  inserted_at TIMESTAMP DEFAULT NOW()
);
`;

const CREATE_BUNDLECART_BILLING_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS bundlecart_billing (
  id SERIAL PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  bundle_id INTEGER NOT NULL REFERENCES link_groups(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL,
  usage_charge_id TEXT,
  app_subscription_id TEXT,
  line_item_id TEXT,
  idempotency_key TEXT,
  billing_mode TEXT,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  billed_at TIMESTAMP,
  CONSTRAINT bundlecart_billing_status_ck CHECK (status IN ('pending', 'success', 'failed'))
);
`;

const CREATE_BUNDLECART_BILLING_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS bundlecart_billing_bundle_id_uq
ON bundlecart_billing (bundle_id);
`;

const CREATE_BUNDLECART_BILLING_IDEMPOTENCY_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS bundlecart_billing_idempotency_key_uq
ON bundlecart_billing (idempotency_key)
WHERE idempotency_key IS NOT NULL;
`;

const CREATE_MERCHANT_BILLING_SUBSCRIPTIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS merchant_billing_subscriptions (
  id SERIAL PRIMARY KEY,
  shop_domain TEXT UNIQUE NOT NULL,
  app_subscription_id TEXT,
  line_item_id TEXT,
  billing_mode TEXT,
  capped_amount NUMERIC(10,2),
  subscription_status TEXT,
  confirmation_url TEXT,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
`;

const CREATE_MERCHANT_BILLING_SUBSCRIPTIONS_SHOP_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS merchant_billing_subscriptions_shop_domain_uq
ON merchant_billing_subscriptions (shop_domain);
`;

const CREATE_LINKED_ORDERS_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS linked_orders_shop_domain_order_id_uq
ON linked_orders (shop_domain, shopify_order_id);
`;

const CREATE_LINK_GROUPS_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS link_groups_email_last_seen_idx
ON link_groups (email, last_seen_at DESC);
`;

const INSERT_SHOPIFY_ORDER_SQL = `
INSERT INTO shopify_orders (
  shop_domain,
  shopify_order_id,
  email,
  created_at,
  total_price,
  currency,
  webhook_id,
  raw_payload
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT DO NOTHING
RETURNING id;
`;

const UPSERT_MERCHANT_SQL = `
INSERT INTO merchants (domain, name, is_active, created_at, updated_at)
VALUES ($1, $1, TRUE, NOW(), NOW())
ON CONFLICT (domain)
DO UPDATE SET
  is_active = TRUE,
  name = COALESCE(merchants.name, EXCLUDED.name),
  access_token = COALESCE(NULLIF(EXCLUDED.access_token, ''), merchants.access_token),
  updated_at = NOW(),
  merchant_country_code = COALESCE(EXCLUDED.merchant_country_code, merchants.merchant_country_code),
  merchant_region = COALESCE(EXCLUDED.merchant_region, merchants.merchant_region);
`;

const SELECT_RECENT_LINK_GROUP_SQL = `
SELECT id
FROM link_groups
WHERE email = $1::text
  AND last_seen_at >= NOW() - INTERVAL '72 hours'
ORDER BY last_seen_at DESC
LIMIT 1;
`;

const UPDATE_LINK_GROUP_LAST_SEEN_SQL = `
UPDATE link_groups
SET last_seen_at = NOW()
WHERE id = $1::integer;
`;

const INSERT_LINK_GROUP_SQL = `
INSERT INTO link_groups (email, created_at, last_seen_at)
VALUES ($1::text, NOW(), NOW())
RETURNING id;
`;

const INSERT_LINKED_ORDER_SQL = `
INSERT INTO linked_orders (
  group_id,
  shop_domain,
  shopify_order_id,
  email,
  bundlecart_selected,
  bundlecart_paid,
  bundlecart_fee_amount,
  address_hash,
  created_at
)
VALUES (
  $1::integer,
  $2::text,
  $3::bigint,
  $4::text,
  $5::boolean,
  $6::boolean,
  $7::numeric,
  $8::text,
  $9::timestamp
)
ON CONFLICT (shop_domain, shopify_order_id) DO NOTHING
RETURNING id;
`;

const SELECT_MATCHING_GROUP_FOR_PAID_SQL = `
SELECT id
FROM link_groups
WHERE email = $1::text
  AND address_hash = $2::text
ORDER BY COALESCE(last_seen_at, created_at) DESC
LIMIT 1;
`;

const SELECT_ELIGIBLE_BUNDLECART_GROUP_SQL = `
SELECT lg.id
FROM link_groups lg
WHERE lg.email = $1::text
  AND lg.address_hash = $2::text
  AND lg.active_until > NOW()
  AND EXISTS (
    SELECT 1
    FROM linked_orders lo
    WHERE lo.group_id = lg.id
      AND lo.bundlecart_paid = TRUE
  )
ORDER BY lg.active_until DESC
LIMIT 1;
`;

const SELECT_ELIGIBLE_BUNDLECART_GROUP_BY_ADDRESS_SQL = `
SELECT lg.id, lg.email
FROM link_groups lg
WHERE lg.address_hash = $1::text
  AND lg.active_until > NOW()
  AND EXISTS (
    SELECT 1
    FROM linked_orders lo
    WHERE lo.group_id = lg.id
      AND lo.bundlecart_paid = TRUE
  )
ORDER BY lg.active_until DESC
LIMIT 1;
`;

const SELECT_ACTIVE_BUNDLE_GROUP_BY_ADDRESS_SQL = `
SELECT lg.id, lg.email, lg.active_until
FROM link_groups lg
WHERE lg.address_hash = $1::text
  AND lg.active_until > NOW()
ORDER BY lg.active_until DESC
LIMIT 1;
`;

const SELECT_LATEST_BUNDLE_GROUP_BY_ADDRESS_SQL = `
SELECT lg.id, lg.email, lg.active_until
FROM link_groups lg
WHERE lg.address_hash = $1::text
ORDER BY COALESCE(lg.active_until, lg.created_at) DESC
LIMIT 1;
`;

const SELECT_ADDRESS_MISMATCH_ACTIVE_GROUP_SQL = `
SELECT lg.id
FROM link_groups lg
WHERE lg.email = $1::text
  AND lg.active_until > NOW()
  AND EXISTS (
    SELECT 1
    FROM linked_orders lo
    WHERE lo.group_id = lg.id
      AND lo.bundlecart_paid = TRUE
  )
  AND (lg.address_hash IS DISTINCT FROM $2::text)
ORDER BY lg.active_until DESC
LIMIT 1;
`;

const SELECT_ACTIVE_GROUPS_FOR_EMAIL_DEBUG_SQL = `
SELECT id, email, address_hash, active_until, bundlecart_paid_at, first_paid_order_id
FROM link_groups
WHERE email = $1::text
  AND active_until > NOW()
ORDER BY active_until DESC
LIMIT 20;
`;

const UPDATE_BUNDLECART_PAID_GROUP_SQL = `
UPDATE link_groups
SET last_seen_at = NOW(),
    bundlecart_paid_at = $2::timestamp,
    active_until = ($2::timestamp + INTERVAL '72 hours'),
    address_hash = $3::text,
    first_paid_order_id = $4::bigint
WHERE id = $1::integer;
`;

const START_BUNDLECART_WINDOW_SQL = `
UPDATE link_groups
SET last_seen_at = NOW(),
    bundlecart_paid_at = $2::timestamp,
    active_until = ($2::timestamp + INTERVAL '72 hours'),
    address_hash = $3::text,
    first_paid_order_id = $4::bigint,
    first_shop_domain = COALESCE($5::text, first_shop_domain)
WHERE id = $1::integer;
`;

const UPDATE_LINK_GROUP_METADATA_SQL = `
UPDATE link_groups
SET customer_address_json = $2::jsonb
WHERE id = $1::integer;
`;

const SELECT_DEBUG_LINKED_ORDERS_BY_EMAIL_SQL = `
SELECT id, group_id, shop_domain, shopify_order_id, email, created_at, inserted_at
FROM linked_orders
WHERE email = $1
ORDER BY inserted_at DESC
LIMIT 20;
`;

const SELECT_MERCHANT_COLUMNS_SQL = `
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'merchants';
`;

const SELECT_TABLE_COLUMNS_SQL = `
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = $1::text
ORDER BY ordinal_position;
`;

const EFFECTIVE_BUNDLE_STATUS_SQL = `
CASE
  WHEN lg.active_until IS NOT NULL AND lg.active_until <= NOW() THEN 'EXPIRED'
  ELSE 'OPEN'
END
`;

const SELECT_ADMIN_BUNDLES_SQL = `
SELECT
  lg.id,
  lg.email,
  lg.customer_address_json,
  lg.bundlecart_paid_at,
  lg.active_until,
  ${EFFECTIVE_BUNDLE_STATUS_SQL} AS bundle_status,
  COUNT(lo.id) AS order_count
FROM link_groups lg
LEFT JOIN linked_orders lo
  ON lo.group_id = lg.id
GROUP BY lg.id
ORDER BY lg.created_at DESC
LIMIT 100;
`;

const SELECT_ADMIN_BUNDLES_READY_SQL = `
SELECT
  lg.id,
  lg.email,
  lg.customer_address_json,
  lg.bundlecart_paid_at,
  lg.active_until,
  ${EFFECTIVE_BUNDLE_STATUS_SQL} AS bundle_status,
  COUNT(lo.id) AS order_count
FROM link_groups lg
LEFT JOIN linked_orders lo
  ON lo.group_id = lg.id
WHERE ${EFFECTIVE_BUNDLE_STATUS_SQL} = 'EXPIRED'
GROUP BY lg.id
ORDER BY lg.created_at DESC
LIMIT 100;
`;

const SELECT_ADMIN_BUNDLE_DETAIL_SQL = `
SELECT
  lg.id,
  lg.email,
  lg.customer_address_json,
  lg.bundlecart_paid_at,
  lg.active_until,
  lg.address_hash,
  ${EFFECTIVE_BUNDLE_STATUS_SQL} AS bundle_status,
  COUNT(lo.id) AS order_count
FROM link_groups lg
LEFT JOIN linked_orders lo
  ON lo.group_id = lg.id
WHERE lg.id = $1::integer
GROUP BY lg.id
LIMIT 1;
`;

const SELECT_ADMIN_LINKED_ORDERS_FOR_BUNDLE_SQL = `
SELECT
  lo.id,
  lo.shopify_order_id,
  lo.shop_domain,
  lo.created_at AS order_created_at,
  lo.bundlecart_selected,
  lo.bundlecart_paid,
  lo.email
FROM linked_orders lo
WHERE lo.group_id = $1::integer
ORDER BY lo.created_at DESC NULLS LAST, lo.inserted_at DESC;
`;

const SELECT_BUNDLE_NOTIFICATION_SUMMARY_SQL = `
SELECT
  lg.id AS bundle_id,
  lg.email AS customer_email,
  lg.active_until,
  COUNT(lo.id)::integer AS order_count
FROM link_groups lg
LEFT JOIN linked_orders lo
  ON lo.group_id = lg.id
WHERE lg.id = $1::integer
GROUP BY lg.id
LIMIT 1;
`;

const SELECT_MERCHANT_DASHBOARD_METRICS_SQL = `
WITH bundles_created AS (
  SELECT COUNT(*)::integer AS value
  FROM link_groups lg
  WHERE lg.first_shop_domain = $1::text
),
orders_bundled AS (
  SELECT COUNT(*)::integer AS value
  FROM linked_orders lo
  WHERE lo.shop_domain = $1::text
),
network_orders AS (
  SELECT COUNT(*)::integer AS value
  FROM linked_orders lo
  JOIN link_groups lg ON lg.id = lo.group_id
  WHERE lo.shop_domain = $1::text
    AND lg.first_shop_domain IS NOT NULL
    AND lg.first_shop_domain <> $1::text
),
orders_in_bundles_created AS (
  SELECT COUNT(lo.id)::integer AS value
  FROM link_groups lg
  LEFT JOIN linked_orders lo ON lo.group_id = lg.id
  WHERE lg.first_shop_domain = $1::text
),
fees_collected AS (
  SELECT COALESCE(SUM(lo.bundlecart_fee_amount), 0)::numeric AS value
  FROM link_groups lg
  JOIN linked_orders lo ON lo.group_id = lg.id
  WHERE lg.first_shop_domain = $1::text
    AND lo.shop_domain = $1::text
    AND lo.bundlecart_paid = TRUE
    AND lo.shopify_order_id = lg.first_paid_order_id
)
SELECT
  bc.value AS bundles_created,
  ob.value AS orders_bundled,
  GREATEST(ob.value - bc.value, 0) AS extra_orders_generated,
  no.value AS network_orders,
  CASE
    WHEN bc.value = 0 THEN 0::numeric
    ELSE ROUND((oic.value::numeric / bc.value::numeric), 2)
  END AS avg_orders_per_bundle,
  fc.value AS bundlecart_fees_collected
FROM bundles_created bc
CROSS JOIN orders_bundled ob
CROSS JOIN network_orders no
CROSS JOIN orders_in_bundles_created oic
CROSS JOIN fees_collected fc;
`;

const SELECT_BUNDLES_FOR_REMINDER_EMAIL_SQL = `
SELECT id, email, active_until
FROM link_groups
WHERE active_until IS NOT NULL
  AND active_until > NOW()
  AND active_until <= NOW() + INTERVAL '24 hours'
  AND COALESCE(reminder_email_sent, FALSE) = FALSE
ORDER BY active_until ASC
LIMIT $1::integer;
`;

const SELECT_BUNDLES_FOR_EXPIRED_EMAIL_SQL = `
SELECT id, email, active_until
FROM link_groups
WHERE active_until IS NOT NULL
  AND active_until <= NOW()
  AND COALESCE(expired_email_sent, FALSE) = FALSE
ORDER BY active_until ASC
LIMIT $1::integer;
`;

const UPDATE_LINK_GROUP_REMINDER_EMAIL_SENT_SQL = `
UPDATE link_groups
SET reminder_email_sent = TRUE
WHERE id = $1::integer;
`;

const UPDATE_LINK_GROUP_EXPIRED_EMAIL_SENT_SQL = `
UPDATE link_groups
SET expired_email_sent = TRUE
WHERE id = $1::integer;
`;

const BACKFILL_LINK_GROUPS_FIRST_SHOP_DOMAIN_SQL = `
WITH first_paid_order AS (
  SELECT DISTINCT ON (lo.group_id)
    lo.group_id,
    lo.shop_domain
  FROM linked_orders lo
  WHERE lo.group_id IS NOT NULL
    AND lo.bundlecart_paid = TRUE
  ORDER BY lo.group_id, lo.created_at ASC NULLS LAST, lo.inserted_at ASC NULLS LAST, lo.id ASC
)
UPDATE link_groups lg
SET first_shop_domain = fpo.shop_domain
FROM first_paid_order fpo
WHERE lg.id = fpo.group_id
  AND lg.first_shop_domain IS NULL;
`;

const ALTER_MERCHANTS_ADD_DOMAIN_SQL = `
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS domain TEXT;
`;

const ALTER_MERCHANTS_ADD_LAST_WEBHOOK_AT_SQL = `
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMP;
`;

const ALTER_MERCHANTS_ADD_NAME_SQL = `
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS name TEXT;
`;

const ALTER_MERCHANTS_ADD_IS_ACTIVE_SQL = `
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
`;

const ALTER_MERCHANTS_ADD_CREATED_AT_SQL = `
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
`;

const ALTER_MERCHANTS_ADD_ACCESS_TOKEN_SQL = `
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS access_token TEXT;
`;

const ALTER_MERCHANTS_ADD_UPDATED_AT_SQL = `
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
`;

const ALTER_MERCHANTS_ADD_MERCHANT_COUNTRY_CODE_SQL = `
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS merchant_country_code TEXT;
`;

const ALTER_MERCHANTS_ADD_MERCHANT_REGION_SQL = `
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS merchant_region TEXT;
`;

const BACKFILL_MERCHANT_DOMAIN_FROM_SHOP_DOMAIN_SQL = `
UPDATE merchants
SET domain = shop_domain
WHERE domain IS NULL
  AND shop_domain IS NOT NULL;
`;

const ALTER_LINK_GROUPS_ADD_EMAIL_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS email TEXT;
`;

const ALTER_LINK_GROUPS_ADD_CREATED_AT_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
`;

const ALTER_LINK_GROUPS_ADD_LAST_SEEN_AT_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT NOW();
`;

const ALTER_LINK_GROUPS_ADD_ACTIVE_UNTIL_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS active_until TIMESTAMP;
`;

const ALTER_LINK_GROUPS_ADD_ADDRESS_HASH_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS address_hash TEXT;
`;

const ALTER_LINK_GROUPS_ADD_BUNDLECART_PAID_AT_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS bundlecart_paid_at TIMESTAMP;
`;

const ALTER_LINK_GROUPS_ADD_FIRST_PAID_ORDER_ID_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS first_paid_order_id BIGINT;
`;

const ALTER_LINK_GROUPS_ADD_FIRST_SHOP_DOMAIN_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS first_shop_domain TEXT;
`;

const ALTER_LINK_GROUPS_ADD_CUSTOMER_ADDRESS_JSON_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS customer_address_json JSONB;
`;

const ALTER_LINK_GROUPS_ADD_REMINDER_EMAIL_SENT_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS reminder_email_sent BOOLEAN DEFAULT FALSE;
`;

const ALTER_LINK_GROUPS_ADD_EXPIRED_EMAIL_SENT_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS expired_email_sent BOOLEAN DEFAULT FALSE;
`;

const ALTER_LINKED_ORDERS_ADD_GROUP_ID_SQL = `
ALTER TABLE linked_orders
ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES link_groups(id) ON DELETE SET NULL;
`;

const ALTER_LINKED_ORDERS_ADD_SHOP_DOMAIN_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS shop_domain TEXT;
`;

const ALTER_LINKED_ORDERS_ADD_SHOPIFY_ORDER_ID_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS shopify_order_id BIGINT;
`;

const ALTER_LINKED_ORDERS_ADD_EMAIL_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS email TEXT;
`;

const ALTER_LINKED_ORDERS_ADD_BUNDLECART_SELECTED_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS bundlecart_selected BOOLEAN DEFAULT FALSE;
`;

const ALTER_LINKED_ORDERS_ADD_BUNDLECART_PAID_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS bundlecart_paid BOOLEAN DEFAULT FALSE;
`;

const ALTER_LINKED_ORDERS_ADD_BUNDLECART_FEE_AMOUNT_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS bundlecart_fee_amount NUMERIC(10,2) DEFAULT 0;
`;

const ALTER_LINKED_ORDERS_ADD_ADDRESS_HASH_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS address_hash TEXT;
`;

const ALTER_LINKED_ORDERS_ADD_CREATED_AT_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
`;

const ALTER_LINKED_ORDERS_ADD_INSERTED_AT_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS inserted_at TIMESTAMP DEFAULT NOW();
`;

const ALTER_BUNDLECART_BILLING_ADD_APP_SUBSCRIPTION_ID_SQL = `
ALTER TABLE bundlecart_billing ADD COLUMN IF NOT EXISTS app_subscription_id TEXT;
`;

const ALTER_BUNDLECART_BILLING_ADD_LINE_ITEM_ID_SQL = `
ALTER TABLE bundlecart_billing ADD COLUMN IF NOT EXISTS line_item_id TEXT;
`;

const ALTER_BUNDLECART_BILLING_ADD_IDEMPOTENCY_KEY_SQL = `
ALTER TABLE bundlecart_billing ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
`;

const ALTER_BUNDLECART_BILLING_ADD_BILLING_MODE_SQL = `
ALTER TABLE bundlecart_billing ADD COLUMN IF NOT EXISTS billing_mode TEXT;
`;

const ALTER_BUNDLECART_BILLING_ADD_FAILURE_REASON_SQL = `
ALTER TABLE bundlecart_billing ADD COLUMN IF NOT EXISTS failure_reason TEXT;
`;

const ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_APP_SUBSCRIPTION_ID_SQL = `
ALTER TABLE merchant_billing_subscriptions ADD COLUMN IF NOT EXISTS app_subscription_id TEXT;
`;

const ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_LINE_ITEM_ID_SQL = `
ALTER TABLE merchant_billing_subscriptions ADD COLUMN IF NOT EXISTS line_item_id TEXT;
`;

const ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_BILLING_MODE_SQL = `
ALTER TABLE merchant_billing_subscriptions ADD COLUMN IF NOT EXISTS billing_mode TEXT;
`;

const ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_CAPPED_AMOUNT_SQL = `
ALTER TABLE merchant_billing_subscriptions ADD COLUMN IF NOT EXISTS capped_amount NUMERIC(10,2);
`;

const ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_SUBSCRIPTION_STATUS_SQL = `
ALTER TABLE merchant_billing_subscriptions ADD COLUMN IF NOT EXISTS subscription_status TEXT;
`;

const ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_CONFIRMATION_URL_SQL = `
ALTER TABLE merchant_billing_subscriptions ADD COLUMN IF NOT EXISTS confirmation_url TEXT;
`;

const ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_LAST_ERROR_SQL = `
ALTER TABLE merchant_billing_subscriptions ADD COLUMN IF NOT EXISTS last_error TEXT;
`;

const ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_CREATED_AT_SQL = `
ALTER TABLE merchant_billing_subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
`;

const ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_UPDATED_AT_SQL = `
ALTER TABLE merchant_billing_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
`;

const UPSERT_MERCHANT_TOKEN_SQL = `
INSERT INTO merchants (name, domain, is_active, access_token, created_at, updated_at)
VALUES ($1, $1, TRUE, $2, NOW(), NOW())
ON CONFLICT (domain)
DO UPDATE SET
  name = EXCLUDED.name,
  is_active = TRUE,
  access_token = EXCLUDED.access_token,
  updated_at = NOW();
`;

const SELECT_MERCHANT_ACCESS_TOKEN_SQL = `
SELECT access_token
FROM merchants
WHERE domain = $1::text
LIMIT 1;
`;

const SELECT_BUNDLECART_BILLING_BY_BUNDLE_SQL = `
SELECT id, status, idempotency_key
FROM bundlecart_billing
WHERE bundle_id = $1::integer
LIMIT 1;
`;

const SELECT_BUNDLECART_BILLING_BY_ID_SQL = `
SELECT
  id,
  shop_domain,
  bundle_id,
  order_id,
  amount,
  status,
  usage_charge_id,
  idempotency_key,
  failure_reason
FROM bundlecart_billing
WHERE id = $1::integer
LIMIT 1;
`;

const SELECT_BILLING_RETRY_ELIGIBLE_SQL = `
SELECT
  id,
  shop_domain,
  bundle_id,
  order_id,
  amount,
  status,
  usage_charge_id,
  idempotency_key,
  failure_reason
FROM bundlecart_billing
WHERE status = 'failed'
  AND usage_charge_id IS NULL
ORDER BY created_at ASC
LIMIT $1::integer;
`;

const SELECT_MERCHANT_BILLING_SUBSCRIPTION_SQL = `
SELECT
  id,
  shop_domain,
  app_subscription_id,
  line_item_id,
  billing_mode,
  capped_amount,
  subscription_status,
  confirmation_url,
  last_error,
  created_at,
  updated_at
FROM merchant_billing_subscriptions
WHERE shop_domain = $1::text
LIMIT 1;
`;

const UPSERT_MERCHANT_BILLING_SUBSCRIPTION_SQL = `
INSERT INTO merchant_billing_subscriptions (
  shop_domain,
  app_subscription_id,
  line_item_id,
  billing_mode,
  capped_amount,
  subscription_status,
  confirmation_url,
  last_error,
  created_at,
  updated_at
)
VALUES (
  $1::text,
  $2::text,
  $3::text,
  $4::text,
  $5::numeric,
  $6::text,
  $7::text,
  $8::text,
  NOW(),
  NOW()
)
ON CONFLICT (shop_domain)
DO UPDATE SET
  app_subscription_id = EXCLUDED.app_subscription_id,
  line_item_id = EXCLUDED.line_item_id,
  billing_mode = EXCLUDED.billing_mode,
  capped_amount = EXCLUDED.capped_amount,
  subscription_status = EXCLUDED.subscription_status,
  confirmation_url = EXCLUDED.confirmation_url,
  last_error = EXCLUDED.last_error,
  updated_at = NOW();
`;

const INSERT_BUNDLECART_BILLING_PENDING_SQL = `
INSERT INTO bundlecart_billing (
  shop_domain,
  bundle_id,
  order_id,
  idempotency_key,
  billing_mode,
  amount,
  status,
  created_at
)
VALUES (
  $1::text,
  $2::integer,
  $3::bigint,
  $4::text,
  $5::text,
  $6::numeric,
  'pending',
  NOW()
)
ON CONFLICT (bundle_id) DO NOTHING
RETURNING id;
`;

const UPDATE_BUNDLECART_BILLING_RETRY_PENDING_SQL = `
UPDATE bundlecart_billing
SET shop_domain = $2::text,
    order_id = $3::bigint,
    idempotency_key = $4::text,
    billing_mode = $5::text,
    amount = $6::numeric,
    status = 'pending',
    usage_charge_id = NULL,
    app_subscription_id = NULL,
    line_item_id = NULL,
    failure_reason = NULL,
    billed_at = NULL
WHERE id = $1::integer;
`;

const UPDATE_BUNDLECART_BILLING_CONTEXT_SQL = `
UPDATE bundlecart_billing
SET app_subscription_id = $2::text,
    line_item_id = $3::text,
    idempotency_key = $4::text,
    billing_mode = $5::text
WHERE id = $1::integer;
`;

const UPDATE_BUNDLECART_BILLING_SUCCESS_SQL = `
UPDATE bundlecart_billing
SET status = 'success',
    usage_charge_id = $2::text,
    app_subscription_id = $3::text,
    line_item_id = $4::text,
    idempotency_key = $5::text,
    billing_mode = $6::text,
    failure_reason = NULL,
    billed_at = NOW()
WHERE id = $1::integer;
`;

const UPDATE_BUNDLECART_BILLING_FAILED_SQL = `
UPDATE bundlecart_billing
SET status = 'failed',
    failure_reason = $2::text
WHERE id = $1::integer;
`;

const SELECT_DEBUG_MERCHANTS_SQL = `
SELECT domain, is_active, created_at, updated_at, access_token
FROM merchants
ORDER BY created_at DESC NULLS LAST
LIMIT 200;
`;

function timingSafeCompare(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function isValidShopifyWebhookSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || !signature || !secret) {
    return false;
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return timingSafeCompare(signature.trim(), expected);
}

function normalizeShopDomain(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  const withoutProtocol = raw.replace(/^https?:\/\//, "");
  return withoutProtocol.replace(/\/+$/, "");
}

function normalizeAddressValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const COUNTRY_CODE_NORMALIZATION = {
  "united states": "us",
  usa: "us",
  us: "us"
};

const PROVINCE_CODE_NORMALIZATION = {
  california: "ca",
  ca: "ca"
};

function normalizeCountryCode(value) {
  const normalized = normalizeAddressValue(value);
  if (!normalized) {
    return "";
  }
  return COUNTRY_CODE_NORMALIZATION[normalized] || normalized;
}

function normalizeProvinceCode(value) {
  const normalized = normalizeAddressValue(value);
  if (!normalized) {
    return "";
  }
  return PROVINCE_CODE_NORMALIZATION[normalized] || normalized;
}

function buildCanonicalAddress(address) {
  const input = address && typeof address === "object" ? address : {};
  const address1 = normalizeAddressValue(input.address1);
  const address2 = normalizeAddressValue(input.address2);
  const city = normalizeAddressValue(input.city);
  const province = normalizeProvinceCode(input.province_code || input.province);
  const postalCode = normalizeAddressValue(input.zip || input.postal_code);
  const country = normalizeCountryCode(input.country_code || input.country);

  return {
    canonical: [address1, address2, city, province, postalCode, country].join("|"),
    hasRequired: Boolean(address1 && city && postalCode && country)
  };
}

function hashAddressCanonical(canonicalAddress) {
  if (!canonicalAddress) {
    return "";
  }
  return crypto.createHash("sha256").update(canonicalAddress).digest("hex");
}

function getOrderShippingAddress(order) {
  if (order?.shipping_address && typeof order.shipping_address === "object") {
    return order.shipping_address;
  }
  return {};
}

function parsePriceAmount(value) {
  const amount = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeCurrencyCode(value) {
  return String(value || "USD")
    .trim()
    .toUpperCase();
}

function isBundleCartPaidFiveUsd({ amount, currency }) {
  const normalizedCurrency = normalizeCurrencyCode(currency);
  return normalizedCurrency === "USD" && Math.abs(Number(amount || 0) - 5) < 0.000001;
}

function detectBundlecartBillingMode() {
  // Managed pricing is controlled directly in Shopify's managed plans UI.
  // In that mode, this app must not fake manual usage billing records.
  const mode = SHOPIFY_BILLING_MODE === "managed" ? "managed" : "manual";
  console.log("BUNDLECART BILLING MODE DETECTED", mode);
  return {
    mode,
    supportsManualUsageBilling: mode === "manual"
  };
}

function detectBundlecartSubscriptionMode() {
  const billingMode = detectBundlecartBillingMode();
  console.log("BUNDLECART SUBSCRIPTION MODE DETECTED", billingMode.mode);
  return billingMode;
}

function getBillingNumericValue(value, fallback) {
  if (Number.isFinite(value) && value >= 0) {
    return value;
  }
  return fallback;
}

function buildBundlecartBillingIdempotencyKey({ shopDomain, bundleId, orderId, amount }) {
  const normalizedShop = normalizeShopDomain(shopDomain);
  const keySource = [
    normalizedShop,
    String(bundleId || ""),
    String(orderId || ""),
    Number(amount || 0).toFixed(2)
  ].join("|");
  return crypto.createHash("sha256").update(keySource).digest("hex");
}

function toBillingFailureReason(errorOrReason) {
  const raw =
    typeof errorOrReason === "string"
      ? errorOrReason
      : String(errorOrReason?.message || "billing_error");
  return raw.slice(0, 300);
}

async function callShopifyAdminGraphql({ shopDomain, accessToken, query, variables }) {
  const normalizedShop = normalizeShopDomain(shopDomain);
  const token = String(accessToken || "").trim();
  if (!normalizedShop || !token) {
    throw new Error("missing_shop_or_token_for_graphql");
  }

  const endpoint = `https://${normalizedShop}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token
    },
    body: JSON.stringify({ query, variables: variables || {} })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`shopify_graphql_status_${response.status}:${body}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    throw new Error(`shopify_graphql_errors:${JSON.stringify(payload.errors)}`);
  }
  return payload?.data || {};
}

async function getStoredMerchantBillingSubscription(shopDomain) {
  if (!dbPool) {
    return null;
  }
  const normalizedShop = normalizeShopDomain(shopDomain);
  if (!normalizedShop) {
    return null;
  }
  const result = await dbPool.query(SELECT_MERCHANT_BILLING_SUBSCRIPTION_SQL, [normalizedShop]);
  return result.rows[0] || null;
}

async function upsertMerchantBillingSubscriptionState({
  shopDomain,
  appSubscriptionId,
  lineItemId,
  billingMode,
  cappedAmount,
  subscriptionStatus,
  confirmationUrl,
  lastError
}) {
  if (!dbPool) {
    return;
  }
  const normalizedShop = normalizeShopDomain(shopDomain);
  if (!normalizedShop) {
    return;
  }
  await dbPool.query(UPSERT_MERCHANT_BILLING_SUBSCRIPTION_SQL, [
    normalizedShop,
    appSubscriptionId || null,
    lineItemId || null,
    billingMode || null,
    cappedAmount != null ? cappedAmount : null,
    subscriptionStatus || null,
    confirmationUrl || null,
    lastError || null
  ]);
}

function buildBundlecartSubscriptionReturnUrl(shopDomain) {
  const normalizedShop = normalizeShopDomain(shopDomain);
  const appUrl = String(process.env.APP_URL || "https://bundle-cart.replit.app").replace(/\/+$/, "");
  const callbackUrl = new URL(`${appUrl}/billing/callback`);
  if (normalizedShop) {
    callbackUrl.searchParams.set("shop", normalizedShop);
  }
  return callbackUrl.toString();
}

function safeJsonString(value) {
  try {
    return JSON.stringify(value ?? "");
  } catch {
    return String(value ?? "");
  }
}

function buildBundleCartRateResponse({ eligibleFree, currency }) {
  const normalizedCurrency = String(currency || "USD").trim().toUpperCase() || "USD";
  const rate = eligibleFree ? BUNDLECART_FREE_RATE : BUNDLECART_PAID_RATE;
  return {
    rates: [
      {
        ...rate,
        currency: normalizedCurrency
      }
    ]
  };
}

function formatBundleExpiryForEmail(activeUntil) {
  if (!activeUntil) {
    return "N/A";
  }
  const parsed = new Date(activeUntil);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }
  return parsed.toUTCString();
}

async function sendBundleCartEmail({ to, subject, text }) {
  const html = String(text || "")
    .split("\n")
    .map((line) => `<p>${line}</p>`)
    .join("");
  await sendEmail({
    to,
    subject,
    html
  });
}

async function getBundleNotificationSummary(bundleId) {
  if (!dbPool) {
    return null;
  }
  const result = await dbPool.query(SELECT_BUNDLE_NOTIFICATION_SUMMARY_SQL, [bundleId]);
  return result.rows[0] || null;
}

async function sendBundleStartedEmailNotification(bundleId, fallbackEmail) {
  try {
    const summary = await getBundleNotificationSummary(bundleId);
    const recipient = String(summary?.customer_email || fallbackEmail || "").trim().toLowerCase();
    const orderCount = Number(summary?.order_count || 0);
    const expiry = formatBundleExpiryForEmail(summary?.active_until);
    const subject = "Your BundleCart shipping window is open";
    const text = [
      "You can place additional orders in the next 72 hours and ship them together with BundleCart.",
      "",
      `Bundle ID: ${bundleId}`,
      `Bundle expires: ${expiry}`,
      `Current order count: ${orderCount}`
    ].join("\n");
    await sendBundleCartEmail({ to: recipient, subject, text });
    console.log("BUNDLECART EMAIL BUNDLE STARTED", bundleId, recipient);
  } catch (error) {
    console.error("BUNDLECART EMAIL BUNDLE STARTED ERROR", bundleId, error);
  }
}

async function sendBundleOrderAddedEmailNotification(bundleId, fallbackEmail) {
  try {
    const summary = await getBundleNotificationSummary(bundleId);
    const recipient = String(summary?.customer_email || fallbackEmail || "").trim().toLowerCase();
    const orderCount = Number(summary?.order_count || 0);
    const expiry = formatBundleExpiryForEmail(summary?.active_until);
    const subject = "A new order was added to your BundleCart bundle";
    const text = [
      "Another order was added to your active BundleCart bundle.",
      "",
      `Bundle ID: ${bundleId}`,
      `Updated order count: ${orderCount}`,
      `Bundle expires: ${expiry}`
    ].join("\n");
    await sendBundleCartEmail({ to: recipient, subject, text });
    console.log("BUNDLECART EMAIL ORDER ADDED", bundleId, recipient);
  } catch (error) {
    console.error("BUNDLECART EMAIL ORDER ADDED ERROR", bundleId, error);
  }
}

async function sendBundleReminderEmail(bundle) {
  const bundleId = Number(bundle?.id || 0);
  const recipient = String(bundle?.email || "").trim().toLowerCase();
  console.log("BUNDLECART EMAIL BUNDLE REMINDER START", bundleId, recipient);

  if (!recipient) {
    console.error("BUNDLECART EMAIL BUNDLE REMINDER ERROR", bundleId, "missing_recipient");
    return false;
  }

  const subject = "Your BundleCart window closes soon";
  const text = [
    "Your BundleCart window is still open.",
    "",
    "Add another order before it closes and it will ship free with your bundle.",
    "",
    "Time remaining: less than 24 hours."
  ].join("\n");

  try {
    await sendBundleCartEmail({ to: recipient, subject, text });
    console.log("BUNDLECART EMAIL BUNDLE REMINDER SENT", bundleId, recipient);
    return true;
  } catch (error) {
    console.error("BUNDLECART EMAIL BUNDLE REMINDER ERROR", bundleId, error);
    return false;
  }
}

async function sendBundleExpiredEmail(bundle) {
  const bundleId = Number(bundle?.id || 0);
  const recipient = String(bundle?.email || "").trim().toLowerCase();
  console.log("BUNDLECART EMAIL BUNDLE EXPIRED START", bundleId, recipient);

  if (!recipient) {
    console.error("BUNDLECART EMAIL BUNDLE EXPIRED ERROR", bundleId, "missing_recipient");
    return false;
  }

  const subject = "Your BundleCart shipping window has closed";
  const text = [
    "Your BundleCart shipping window has closed.",
    "",
    "Your orders will now ship separately.",
    "",
    "You can start a new BundleCart bundle anytime on your next order."
  ].join("\n");

  try {
    await sendBundleCartEmail({ to: recipient, subject, text });
    console.log("BUNDLECART EMAIL BUNDLE EXPIRED SENT", bundleId, recipient);
    return true;
  } catch (error) {
    console.error("BUNDLECART EMAIL BUNDLE EXPIRED ERROR", bundleId, error);
    return false;
  }
}

async function runBundleLifecycleEmailJobs() {
  if (!dbPool) {
    return;
  }

  try {
    const reminderBundlesResult = await dbPool.query(SELECT_BUNDLES_FOR_REMINDER_EMAIL_SQL, [
      BUNDLECART_EMAIL_WORKER_BATCH_LIMIT
    ]);
    for (const bundle of reminderBundlesResult.rows) {
      const sent = await sendBundleReminderEmail(bundle);
      if (sent) {
        await dbPool.query(UPDATE_LINK_GROUP_REMINDER_EMAIL_SENT_SQL, [bundle.id]);
      }
    }

    const expiredBundlesResult = await dbPool.query(SELECT_BUNDLES_FOR_EXPIRED_EMAIL_SQL, [
      BUNDLECART_EMAIL_WORKER_BATCH_LIMIT
    ]);
    for (const bundle of expiredBundlesResult.rows) {
      const sent = await sendBundleExpiredEmail(bundle);
      if (sent) {
        await dbPool.query(UPDATE_LINK_GROUP_EXPIRED_EMAIL_SENT_SQL, [bundle.id]);
      }
    }
  } catch (error) {
    console.error("BUNDLECART EMAIL WORKER ERROR", error);
  }
}

let bundleLifecycleEmailWorkerStarted = false;
function startBundleLifecycleEmailWorker() {
  if (bundleLifecycleEmailWorkerStarted) {
    return;
  }
  bundleLifecycleEmailWorkerStarted = true;

  void runBundleLifecycleEmailJobs();
  setInterval(() => {
    void runBundleLifecycleEmailJobs();
  }, BUNDLECART_EMAIL_WORKER_INTERVAL_MS);
}

function isBundleCartShippingLine(line) {
  const fields = [
    line?.title,
    line?.code,
    line?.service_code,
    line?.source,
    line?.carrier_identifier,
    line?.description,
    line?.requested_fulfillment_service_id,
    safeJsonString(line?.custom_attributes)
  ];
  return fields.some((field) =>
    String(field || "").toLowerCase().includes("bundlecart")
  );
}

function extractShippingLineAmount(line) {
  const candidates = [
    line?.price,
    line?.discounted_price,
    line?.amount,
    line?.shop_money?.amount,
    line?.presentment_money?.amount,
    line?.price_set?.shop_money?.amount,
    line?.price_set?.presentment_money?.amount
  ];
  const numericCandidates = candidates
    .map((value) => parsePriceAmount(value))
    .filter((value) => Number.isFinite(value));
  if (numericCandidates.length === 0) {
    return 0;
  }
  return Math.max(...numericCandidates);
}

function extractBundleCartSelection(order) {
  const shippingLines = Array.isArray(order?.shipping_lines) ? order.shipping_lines : [];
  const bundleCartLines = shippingLines.filter(isBundleCartShippingLine);
  if (bundleCartLines.length === 0) {
    console.log("BUNDLECART SHIPPING NOT MATCHED");
    return { selected: false, paid: false, free: false, amount: 0 };
  }

  const amount = bundleCartLines.reduce(
    (sum, line) => sum + extractShippingLineAmount(line),
    0
  );
  console.log("BUNDLECART SHIPPING MATCHED", safeJsonString(bundleCartLines[0]));
  if (amount > 0) {
    console.log("BUNDLECART PAID DETECTED", amount);
  } else {
    console.log("BUNDLECART FREE DETECTED", amount);
  }

  return {
    selected: true,
    paid: amount > 0,
    free: amount === 0,
    amount
  };
}

async function fetchShopifyUsageBillingContext({ shopDomain, accessToken }) {
  const normalizedShop = normalizeShopDomain(shopDomain);
  console.log("BUNDLECART BILLING SUBSCRIPTION CHECK", normalizedShop);
  const query = `
    query BundleCartUsageLineItem {
      currentAppInstallation {
        activeSubscriptions {
          id
          status
          lineItems {
            id
            plan {
              pricingDetails {
                __typename
                ... on AppUsagePricing {
                  cappedAmount {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  const data = await callShopifyAdminGraphql({
    shopDomain: normalizedShop,
    accessToken,
    query
  });

  const subscriptions = Array.isArray(data?.currentAppInstallation?.activeSubscriptions)
    ? data.currentAppInstallation.activeSubscriptions
    : [];
  for (const subscription of subscriptions) {
    const status = String(subscription?.status || "").toUpperCase();
    if (status && status !== "ACTIVE") {
      continue;
    }
    const lineItems = Array.isArray(subscription?.lineItems) ? subscription.lineItems : [];
    for (const lineItem of lineItems) {
      if (lineItem?.plan?.pricingDetails?.__typename !== "AppUsagePricing" || !lineItem?.id) {
        continue;
      }
      const cappedAmountValue = parsePriceAmount(
        lineItem?.plan?.pricingDetails?.cappedAmount?.amount
      );
      if (cappedAmountValue > 0) {
        return {
          appSubscriptionId: String(subscription?.id || ""),
          lineItemId: String(lineItem.id),
          cappedAmount: cappedAmountValue,
          subscriptionStatus: status || "ACTIVE"
        };
      }
    }
  }

  console.log("BUNDLECART BILLING SUBSCRIPTION MISSING", normalizedShop);
  return null;
}

async function createBundlecartAppSubscription({ shopDomain, accessToken }) {
  const normalizedShop = normalizeShopDomain(shopDomain);
  if (!normalizedShop) {
    throw new Error("missing_shop_for_subscription_create");
  }

  console.log("BUNDLECART SUBSCRIPTION CREATE START", normalizedShop);
  if (SHOPIFY_BILLING_TEST_MODE) {
    console.log("BUNDLECART SUBSCRIPTION TEST MODE", normalizedShop);
  }

  const usageCapAmount = getBillingNumericValue(SHOPIFY_BILLING_USAGE_CAP_AMOUNT, 1000);
  const recurringBaseAmount = getBillingNumericValue(SHOPIFY_BILLING_BASE_PLAN_AMOUNT, 0);
  const returnUrl = buildBundlecartSubscriptionReturnUrl(normalizedShop);
  const lineItems = [
    {
      plan: {
        appRecurringPricingDetails: {
          interval: "EVERY_30_DAYS",
          price: {
            amount: recurringBaseAmount,
            currencyCode: "USD"
          }
        }
      }
    },
    {
      plan: {
        appUsagePricingDetails: {
          terms: "BundleCart network shipping fee",
          cappedAmount: {
            amount: usageCapAmount,
            currencyCode: "USD"
          }
        }
      }
    }
  ];
  const requestInputSummary = {
    planName: SHOPIFY_BILLING_PLAN_NAME || "BundleCart Network Billing",
    returnUrl,
    test: SHOPIFY_BILLING_TEST_MODE,
    cappedAmount: usageCapAmount,
    lineItemTypes: lineItems.map((item) => Object.keys(item.plan || {}))
  };
  console.log("BUNDLECART SUBSCRIPTION CREATE INPUT SUMMARY", JSON.stringify(requestInputSummary));
  const mutation = `
    mutation BundleCartSubscriptionCreate(
      $name: String!
      $lineItems: [AppSubscriptionLineItemInput!]!
      $returnUrl: URL!
      $test: Boolean
    ) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        lineItems: $lineItems
        test: $test
      ) {
        appSubscription {
          id
          status
          lineItems {
            id
            plan {
              pricingDetails {
                __typename
                ... on AppUsagePricing {
                  cappedAmount {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
        confirmationUrl
        userErrors {
          field
          message
        }
      }
    }
  `;
  const variables = {
    name: SHOPIFY_BILLING_PLAN_NAME || "BundleCart Network Billing",
    returnUrl,
    test: SHOPIFY_BILLING_TEST_MODE,
    lineItems
  };

  let payload = null;
  try {
    const endpoint = `https://${normalizedShop}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const responseText = await response.text();
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error("BUNDLECART SUBSCRIPTION CREATE RESPONSE PARSE ERROR", parseError);
      console.error("BUNDLECART SUBSCRIPTION CREATE RAW RESPONSE", responseText);
      throw new Error(`subscription_create_response_parse_error:${response.status}`);
    }

    const topLevelErrors = Array.isArray(payload?.errors) ? payload.errors : [];
    const userErrors = Array.isArray(payload?.data?.appSubscriptionCreate?.userErrors)
      ? payload.data.appSubscriptionCreate.userErrors
      : [];

    if (!response.ok || topLevelErrors.length > 0 || userErrors.length > 0) {
      console.error("BUNDLECART SUBSCRIPTION CREATE USER ERRORS", JSON.stringify(userErrors));
      console.error(
        "BUNDLECART SUBSCRIPTION CREATE TOP LEVEL ERRORS",
        JSON.stringify(topLevelErrors)
      );
      console.error(
        "BUNDLECART SUBSCRIPTION CREATE REQUEST INPUT",
        JSON.stringify(requestInputSummary)
      );
      console.error("BUNDLECART SUBSCRIPTION CREATE GRAPHQL RESPONSE", JSON.stringify(payload));

      if (!response.ok) {
        throw new Error(`subscription_create_http_error:${response.status}`);
      }
      if (userErrors.length > 0) {
        throw new Error(`subscription_create_user_error:${JSON.stringify(userErrors)}`);
      }
      throw new Error(`subscription_create_top_level_error:${JSON.stringify(topLevelErrors)}`);
    }
  } catch (error) {
    // Keep throwing to preserve existing control flow; this block is diagnostics-focused.
    throw error;
  }

  const createPayload = payload?.data?.appSubscriptionCreate;
  const userErrors = Array.isArray(createPayload?.userErrors) ? createPayload.userErrors : [];
  if (userErrors.length > 0) {
    throw new Error(`subscription_create_user_error:${JSON.stringify(userErrors)}`);
  }

  const confirmationUrl = String(createPayload?.confirmationUrl || "").trim();
  if (!confirmationUrl) {
    throw new Error("subscription_create_missing_confirmation_url");
  }

  const subscription = createPayload?.appSubscription || {};
  const subscriptionLineItems = Array.isArray(subscription?.lineItems) ? subscription.lineItems : [];
  const usageLineItem = subscriptionLineItems.find(
    (item) => item?.plan?.pricingDetails?.__typename === "AppUsagePricing"
  );
  const cappedAmountValue = parsePriceAmount(
    usageLineItem?.plan?.pricingDetails?.cappedAmount?.amount
  );

  console.log("BUNDLECART SUBSCRIPTION CREATE SUCCESS", normalizedShop);
  console.log("BUNDLECART SUBSCRIPTION APPROVAL REQUIRED", normalizedShop, confirmationUrl);

  return {
    confirmationUrl,
    appSubscriptionId: subscription?.id ? String(subscription.id) : "",
    lineItemId: usageLineItem?.id ? String(usageLineItem.id) : "",
    cappedAmount: cappedAmountValue > 0 ? cappedAmountValue : null,
    subscriptionStatus: String(subscription?.status || "PENDING")
  };
}

async function ensureMerchantBillingSubscription({
  shopDomain,
  accessToken,
  createIfMissing = true
}) {
  const normalizedShop = normalizeShopDomain(shopDomain);
  const token = String(accessToken || "").trim();
  const subscriptionMode = detectBundlecartSubscriptionMode();

  if (!normalizedShop || !token) {
    return {
      mode: subscriptionMode.mode,
      active: false,
      approvalRequired: false,
      reason: "missing_shop_or_token"
    };
  }

  if (!subscriptionMode.supportsManualUsageBilling) {
    // Managed pricing stores plan logic in Shopify-managed pricing configuration.
    // Manual app subscription creation is intentionally skipped in this mode.
    await upsertMerchantBillingSubscriptionState({
      shopDomain: normalizedShop,
      billingMode: subscriptionMode.mode,
      subscriptionStatus: "managed_mode",
      lastError: "managed_pricing_mode_manual_subscription_not_created"
    });
    return {
      mode: subscriptionMode.mode,
      active: false,
      approvalRequired: false,
      reason: "managed_mode_manual_subscription_disabled"
    };
  }

  try {
    const usageBillingContext = await fetchShopifyUsageBillingContext({
      shopDomain: normalizedShop,
      accessToken: token
    });
    if (usageBillingContext?.lineItemId) {
      await upsertMerchantBillingSubscriptionState({
        shopDomain: normalizedShop,
        appSubscriptionId: usageBillingContext.appSubscriptionId || null,
        lineItemId: usageBillingContext.lineItemId || null,
        billingMode: subscriptionMode.mode,
        cappedAmount: usageBillingContext.cappedAmount ?? null,
        subscriptionStatus: usageBillingContext.subscriptionStatus || "active",
        confirmationUrl: null,
        lastError: null
      });
      console.log("BUNDLECART SUBSCRIPTION CONFIRMED", normalizedShop);
      return {
        mode: subscriptionMode.mode,
        active: true,
        approvalRequired: false,
        context: usageBillingContext
      };
    }
  } catch (lookupError) {
    await upsertMerchantBillingSubscriptionState({
      shopDomain: normalizedShop,
      billingMode: subscriptionMode.mode,
      subscriptionStatus: "failed",
      lastError: toBillingFailureReason(lookupError)
    });
    console.error("BUNDLECART SUBSCRIPTION CREATE FAILED", normalizedShop, lookupError);
    return {
      mode: subscriptionMode.mode,
      active: false,
      approvalRequired: false,
      reason: "subscription_lookup_failed",
      error: lookupError
    };
  }

  const storedSubscription = await getStoredMerchantBillingSubscription(normalizedShop);
  if (
    storedSubscription?.subscription_status === "pending_approval" &&
    storedSubscription?.confirmation_url
  ) {
    console.log(
      "BUNDLECART SUBSCRIPTION APPROVAL REQUIRED",
      normalizedShop,
      storedSubscription.confirmation_url
    );
    return {
      mode: subscriptionMode.mode,
      active: false,
      approvalRequired: true,
      confirmationUrl: String(storedSubscription.confirmation_url)
    };
  }

  if (!createIfMissing) {
    await upsertMerchantBillingSubscriptionState({
      shopDomain: normalizedShop,
      billingMode: subscriptionMode.mode,
      subscriptionStatus: "missing",
      lastError: "missing_active_usage_subscription"
    });
    return {
      mode: subscriptionMode.mode,
      active: false,
      approvalRequired: false,
      reason: "missing_active_usage_subscription"
    };
  }

  try {
    const createdSubscription = await createBundlecartAppSubscription({
      shopDomain: normalizedShop,
      accessToken: token
    });
    await upsertMerchantBillingSubscriptionState({
      shopDomain: normalizedShop,
      appSubscriptionId: createdSubscription.appSubscriptionId || null,
      lineItemId: createdSubscription.lineItemId || null,
      billingMode: subscriptionMode.mode,
      cappedAmount: createdSubscription.cappedAmount ?? null,
      subscriptionStatus: "pending_approval",
      confirmationUrl: createdSubscription.confirmationUrl || null,
      lastError: null
    });
    return {
      mode: subscriptionMode.mode,
      active: false,
      approvalRequired: true,
      confirmationUrl: createdSubscription.confirmationUrl
    };
  } catch (createError) {
    await upsertMerchantBillingSubscriptionState({
      shopDomain: normalizedShop,
      billingMode: subscriptionMode.mode,
      subscriptionStatus: "failed",
      lastError: toBillingFailureReason(createError)
    });
    console.error("BUNDLECART SUBSCRIPTION CREATE FAILED", normalizedShop, createError);
    return {
      mode: subscriptionMode.mode,
      active: false,
      approvalRequired: false,
      reason: "subscription_create_failed",
      error: createError
    };
  }
}

async function createBundlecartUsageCharge({
  shopDomain,
  accessToken,
  subscriptionLineItemId,
  idempotencyKey,
  bundleId,
  orderId,
  amount
}) {
  const normalizedShop = normalizeShopDomain(shopDomain);
  const token = String(accessToken || "").trim();
  if (!normalizedShop || !token || !subscriptionLineItemId || !idempotencyKey) {
    throw new Error("missing_shop_or_token_for_billing");
  }

  if (SHOPIFY_BILLING_TEST_MODE) {
    console.log("BUNDLECART BILLING TEST MODE", normalizedShop, bundleId, orderId);
    return `test_mode_${idempotencyKey}`;
  }

  const endpoint = `https://${normalizedShop}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;
  const mutation = `
    mutation BundleCartUsageCharge(
      $description: String!
      $price: MoneyInput!
      $subscriptionLineItemId: ID!
      $idempotencyKey: String!
    ) {
      appUsageRecordCreate(
        description: $description
        price: $price
        subscriptionLineItemId: $subscriptionLineItemId
        idempotencyKey: $idempotencyKey
      ) {
        appUsageRecord {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const variables = {
    description: `BundleCart network shipping fee | bundle_id=${bundleId} | order_id=${orderId}`,
    price: {
      amount: Number(amount || 0),
      currencyCode: "USD"
    },
    subscriptionLineItemId,
    idempotencyKey
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token
    },
    body: JSON.stringify({ query: mutation, variables })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`usage_charge_create_failed_${response.status}:${body}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    throw new Error(`usage_charge_create_graphql_error:${JSON.stringify(payload.errors)}`);
  }

  const userErrors = payload?.data?.appUsageRecordCreate?.userErrors;
  if (Array.isArray(userErrors) && userErrors.length > 0) {
    throw new Error(`usage_charge_user_error:${JSON.stringify(userErrors)}`);
  }

  const usageChargeId = payload?.data?.appUsageRecordCreate?.appUsageRecord?.id;
  if (!usageChargeId) {
    throw new Error("usage_charge_missing_id");
  }

  console.log("BUNDLECART USAGE CHARGE REQUEST", normalizedShop, bundleId, orderId, amount);
  return String(usageChargeId);
}

async function processBundlecartMerchantBilling({
  shopDomain,
  bundleId,
  orderId,
  amount
}) {
  if (!dbPool) {
    return;
  }

  const normalizedShop = normalizeShopDomain(shopDomain);
  if (!normalizedShop || !bundleId || !orderId) {
    return;
  }

  console.log("BUNDLECART MERCHANT BILLING START", normalizedShop, bundleId, orderId);
  const billingMode = detectBundlecartBillingMode();
  const idempotencyKey = buildBundlecartBillingIdempotencyKey({
    shopDomain: normalizedShop,
    bundleId,
    orderId,
    amount
  });
  console.log("BUNDLECART BILLING IDEMPOTENCY KEY GENERATED", idempotencyKey);

  let billingRecordId = null;
  const existingBillingResult = await dbPool.query(SELECT_BUNDLECART_BILLING_BY_BUNDLE_SQL, [bundleId]);
  if (existingBillingResult.rowCount > 0) {
    const existingBilling = existingBillingResult.rows[0];
    const existingStatus = String(existingBilling.status || "").toLowerCase();
    if (existingStatus === "success" || existingStatus === "pending") {
      console.log("BUNDLECART BILLING SKIPPED DUPLICATE", normalizedShop, bundleId, orderId);
      return;
    }

    billingRecordId = existingBilling.id;
    await dbPool.query(UPDATE_BUNDLECART_BILLING_RETRY_PENDING_SQL, [
      billingRecordId,
      normalizedShop,
      orderId,
      idempotencyKey,
      billingMode.mode,
      amount
    ]);
  } else {
    const pendingResult = await dbPool.query(INSERT_BUNDLECART_BILLING_PENDING_SQL, [
      normalizedShop,
      bundleId,
      orderId,
      idempotencyKey,
      billingMode.mode,
      amount
    ]);

    if (pendingResult.rowCount === 0) {
      console.log("BUNDLECART BILLING SKIPPED DUPLICATE", normalizedShop, bundleId, orderId);
      return;
    }
    billingRecordId = pendingResult.rows[0].id;
  }

  try {
    if (!billingMode.supportsManualUsageBilling) {
      const reason = "managed_pricing_mode_manual_usage_not_supported";
      console.log("BUNDLECART BILLING PREREQUISITE FAILED", normalizedShop, bundleId, reason);
      await dbPool.query(UPDATE_BUNDLECART_BILLING_FAILED_SQL, [
        billingRecordId,
        toBillingFailureReason(reason)
      ]);
      return;
    }

    const merchantResult = await dbPool.query(SELECT_MERCHANT_ACCESS_TOKEN_SQL, [normalizedShop]);
    const accessToken = String(merchantResult.rows[0]?.access_token || "").trim();
    if (!accessToken) {
      const reason = "missing_merchant_access_token";
      console.log("BUNDLECART BILLING PREREQUISITE FAILED", normalizedShop, bundleId, reason);
      await dbPool.query(UPDATE_BUNDLECART_BILLING_FAILED_SQL, [
        billingRecordId,
        toBillingFailureReason(reason)
      ]);
      return;
    }

    const subscriptionCheck = await ensureMerchantBillingSubscription({
      shopDomain: normalizedShop,
      accessToken,
      createIfMissing: true
    });
    if (!subscriptionCheck?.active || !subscriptionCheck?.context?.lineItemId) {
      const reason = subscriptionCheck?.approvalRequired
        ? `subscription_approval_required:${subscriptionCheck.confirmationUrl || ""}`
        : subscriptionCheck?.reason || "missing_active_usage_billing_subscription";
      console.log("BUNDLECART BILLING SUBSCRIPTION MISSING", normalizedShop);
      console.log("BUNDLECART BILLING PREREQUISITE FAILED", normalizedShop, bundleId, reason);
      await dbPool.query(UPDATE_BUNDLECART_BILLING_FAILED_SQL, [
        billingRecordId,
        toBillingFailureReason(reason)
      ]);
      return;
    }
    const usageBillingContext = subscriptionCheck.context;

    await dbPool.query(UPDATE_BUNDLECART_BILLING_CONTEXT_SQL, [
      billingRecordId,
      usageBillingContext.appSubscriptionId || null,
      usageBillingContext.lineItemId || null,
      idempotencyKey,
      billingMode.mode
    ]);

    const usageChargeId = await createBundlecartUsageCharge({
      shopDomain: normalizedShop,
      accessToken,
      subscriptionLineItemId: usageBillingContext.lineItemId,
      idempotencyKey,
      bundleId,
      orderId,
      amount
    });

    await dbPool.query(UPDATE_BUNDLECART_BILLING_SUCCESS_SQL, [
      billingRecordId,
      usageChargeId,
      usageBillingContext.appSubscriptionId || null,
      usageBillingContext.lineItemId || null,
      idempotencyKey,
      billingMode.mode
    ]);
    console.log("BUNDLECART MERCHANT BILLED 5 USD", normalizedShop, bundleId, orderId, usageChargeId);
  } catch (error) {
    await dbPool.query(UPDATE_BUNDLECART_BILLING_FAILED_SQL, [
      billingRecordId,
      toBillingFailureReason(error)
    ]);
    console.error("BUNDLECART BILLING FAILED", normalizedShop, bundleId, orderId, error);
  }
}

function isPermanentBillingFailureReason(reason) {
  const normalizedReason = String(reason || "").toLowerCase();
  if (!normalizedReason) {
    return false;
  }
  return (
    normalizedReason.includes("managed_pricing_mode_manual_usage_not_supported") ||
    normalizedReason.includes("missing_merchant_access_token") ||
    normalizedReason.includes("subscription_approval_required") ||
    normalizedReason.includes("missing_active_usage_billing_subscription")
  );
}

async function retryFailedBundlecartBilling({ limit = 100 } = {}) {
  if (!dbPool) {
    return { ok: false, attempted: 0, succeeded: 0, failed: 0, skipped: 0, reason: "no_db_pool" };
  }

  const maxLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 500) : 100;
  const eligibleResult = await dbPool.query(SELECT_BILLING_RETRY_ELIGIBLE_SQL, [maxLimit]);
  const rows = eligibleResult.rows;
  console.log("BUNDLECART BILLING RETRY START", { eligible: rows.length, limit: maxLimit });

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const billingId = Number(row.id);
    const shopDomain = String(row.shop_domain || "");
    const bundleId = Number(row.bundle_id);
    const orderId = String(row.order_id || "");
    const amount = Number.parseFloat(String(row.amount ?? "0")) || 0;
    const failureReason = String(row.failure_reason || "");

    if (!billingId || !shopDomain || !bundleId || !orderId) {
      skipped += 1;
      console.error("BUNDLECART BILLING RETRY FAILED", {
        billingId,
        reason: "invalid_row"
      });
      continue;
    }

    if (isPermanentBillingFailureReason(failureReason)) {
      skipped += 1;
      console.error("BUNDLECART BILLING RETRY FAILED", {
        billingId,
        bundleId,
        orderId,
        reason: "permanent_failure_reason"
      });
      continue;
    }

    const currentResult = await dbPool.query(SELECT_BUNDLECART_BILLING_BY_ID_SQL, [billingId]);
    const currentRow = currentResult.rows[0];
    if (!currentRow || currentRow.usage_charge_id) {
      skipped += 1;
      console.log("BUNDLECART BILLING RETRY SKIPPED DUPLICATE", {
        billingId,
        bundleId,
        orderId,
        reason: "already_has_usage_charge"
      });
      continue;
    }

    attempted += 1;
    console.log("BUNDLECART BILLING RETRY ATTEMPT", {
      billingId,
      shopDomain,
      bundleId,
      orderId
    });

    try {
      await processBundlecartMerchantBilling({
        shopDomain,
        bundleId,
        orderId,
        amount
      });

      const afterResult = await dbPool.query(SELECT_BUNDLECART_BILLING_BY_ID_SQL, [billingId]);
      const afterRow = afterResult.rows[0];
      if (afterRow?.status === "success" && afterRow?.usage_charge_id) {
        succeeded += 1;
        console.log("BUNDLECART BILLING RETRY SUCCESS", {
          billingId,
          bundleId,
          orderId,
          usage_charge_id: afterRow.usage_charge_id
        });
      } else {
        failed += 1;
        console.error("BUNDLECART BILLING RETRY FAILED", {
          billingId,
          bundleId,
          orderId,
          failure_reason: afterRow?.failure_reason || "unknown"
        });
      }
    } catch (error) {
      failed += 1;
      console.error("BUNDLECART BILLING RETRY FAILED", {
        billingId,
        bundleId,
        orderId,
        error: toBillingFailureReason(error)
      });
    }
  }

  return {
    ok: true,
    scanned: rows.length,
    attempted,
    succeeded,
    failed,
    skipped
  };
}

async function registerBundleCartCarrierService({ shopDomain, accessToken }) {
  const normalizedShop = normalizeShopDomain(shopDomain);
  const token = String(accessToken || "").trim();

  if (!normalizedShop || !token) {
    return;
  }

  const endpoint = `https://${normalizedShop}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/carrier_services.json`;

  try {
    const listResponse = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Shopify-Access-Token": token
      }
    });

    if (!listResponse.ok) {
      throw new Error(`carrier service list failed: ${listResponse.status}`);
    }

    let listPayload = {};
    try {
      listPayload = await listResponse.json();
    } catch {
      listPayload = {};
    }

    const existingServices = Array.isArray(listPayload?.carrier_services)
      ? listPayload.carrier_services
      : [];
    const alreadyExists = existingServices.some(
      (service) => String(service?.name || "").trim() === BUNDLECART_CARRIER_NAME
    );

    if (alreadyExists) {
      console.log("CARRIER SERVICE EXISTS", normalizedShop);
      return;
    }

    const createResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token
      },
      body: JSON.stringify({
        carrier_service: {
          name: BUNDLECART_CARRIER_NAME,
          callback_url: BUNDLECART_CALLBACK_URL,
          service_discovery: true
        }
      })
    });

    if (createResponse.ok) {
      console.log("CARRIER SERVICE CREATED", normalizedShop);
      return;
    }

    let createErrorPayload = "";
    try {
      createErrorPayload = await createResponse.text();
    } catch {
      createErrorPayload = "";
    }
    console.error(
      "CARRIER SERVICE CREATE ERROR",
      normalizedShop,
      createResponse.status,
      createErrorPayload
    );
  } catch (error) {
    console.error("CARRIER SERVICE CREATE ERROR", normalizedShop, error);
  }
}

async function registerCarrierServiceForShop(shopDomain, accessToken) {
  const normalizedShop = normalizeShopDomain(shopDomain);
  if (!normalizedShop || !String(accessToken || "").trim()) {
    return;
  }
  console.log("REGISTER CARRIER SERVICE", normalizedShop);
  await registerBundleCartCarrierService({
    shopDomain: normalizedShop,
    accessToken
  });
}

async function checkShopifyWriteOrdersScope(shopDomain, accessToken) {
  const normalizedShop = normalizeShopDomain(shopDomain);
  const token = String(accessToken || "").trim();
  if (!normalizedShop || !token) {
    return false;
  }

  console.log("SHOPIFY SCOPES CHECK START", normalizedShop);
  try {
    const response = await fetch(`https://${normalizedShop}/admin/oauth/access_scopes.json`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Shopify-Access-Token": token
      }
    });

    if (!response.ok) {
      throw new Error(`scope_check_failed_${response.status}`);
    }

    const payload = await response.json();
    const scopes = Array.isArray(payload?.access_scopes)
      ? payload.access_scopes
          .map((scope) => String(scope?.handle || "").trim())
          .filter(Boolean)
      : [];

    console.log("SHOPIFY SCOPES CHECK RESULT", normalizedShop, scopes);
    const hasWriteOrders = scopes.includes("write_orders");
    if (!hasWriteOrders) {
      console.log("SHOPIFY MISSING REQUIRED SCOPE", normalizedShop, "write_orders");
    }
    return hasWriteOrders;
  } catch (error) {
    console.error("SHOPIFY SCOPES CHECK ERROR", normalizedShop, error);
    return false;
  }
}

async function findMerchantAuthByShop(shopDomain) {
  const normalizedShop = normalizeShopDomain(shopDomain);
  if (!dbPool || !normalizedShop) {
    return { exists: false, tokenPresent: false };
  }

  try {
    const result = await dbPool.query(
      "SELECT domain, access_token FROM merchants WHERE domain = $1::text LIMIT 1",
      [normalizedShop]
    );
    if (result.rowCount === 0) {
      return { exists: false, tokenPresent: false };
    }
    const token = String(result.rows[0]?.access_token || "").trim();
    return { exists: true, tokenPresent: Boolean(token) };
  } catch (error) {
    console.error("APP ROOT AUTH LOOKUP ERROR", normalizedShop, error);
    return { exists: false, tokenPresent: false };
  }
}

async function enforceBundlecartBillingAccess(req, res, options = {}) {
  const { allowMissingShop = false } = options;
  const shop = normalizeShopDomain(req.query.shop);
  console.log("BUNDLECART BILLING ACCESS CHECK", {
    path: req.path,
    shop: shop || "",
    allowMissingShop
  });

  if (!shop) {
    return { allowed: Boolean(allowMissingShop), shop: "" };
  }

  if (!dbPool) {
    res.status(503).send("Billing check unavailable");
    return { allowed: false, shop };
  }

  const subscriptionMode = detectBundlecartSubscriptionMode();
  if (!subscriptionMode.supportsManualUsageBilling) {
    console.log("BUNDLECART BILLING ACTIVE", shop, "managed_mode");
    return { allowed: true, shop };
  }

  const merchantAuth = await findMerchantAuthByShop(shop);
  if (!merchantAuth.exists || !merchantAuth.tokenPresent) {
    res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
    return { allowed: false, shop };
  }

  const merchantResult = await dbPool.query(SELECT_MERCHANT_ACCESS_TOKEN_SQL, [shop]);
  const accessToken = String(merchantResult.rows[0]?.access_token || "").trim();
  if (!accessToken) {
    res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
    return { allowed: false, shop };
  }

  const subscriptionResult = await ensureMerchantBillingSubscription({
    shopDomain: shop,
    accessToken,
    createIfMissing: true
  });

  if (subscriptionResult?.active) {
    console.log("BUNDLECART BILLING ACTIVE", shop);
    return { allowed: true, shop };
  }

  const billingRedirectUrl =
    subscriptionResult?.confirmationUrl || `/billing/subscribe?shop=${encodeURIComponent(shop)}`;
  console.log("BUNDLECART REDIRECTING TO BILLING", shop, billingRedirectUrl);
  res.redirect(billingRedirectUrl);
  return { allowed: false, shop };
}

async function registerCarrierServiceForActiveMerchants() {
  if (!dbPool) {
    return;
  }

  try {
    const columnsResult = await dbPool.query(SELECT_MERCHANT_COLUMNS_SQL);
    const columns = new Set(columnsResult.rows.map((row) => row.column_name));

    const domainColumn = columns.has("domain")
      ? "domain"
      : columns.has("shop_domain")
        ? "shop_domain"
        : "";
    const accessTokenColumn = columns.has("access_token")
      ? "access_token"
      : columns.has("shopify_access_token")
        ? "shopify_access_token"
        : columns.has("token")
          ? "token"
          : "";

    if (!domainColumn || !accessTokenColumn) {
      return;
    }

    const activeFilter = columns.has("is_active") ? " AND is_active = TRUE" : "";
    const merchantsQuery = `SELECT ${domainColumn} AS shop_domain, ${accessTokenColumn} AS access_token FROM merchants WHERE ${accessTokenColumn} IS NOT NULL AND ${accessTokenColumn} <> ''${activeFilter} LIMIT 200`;
    const merchantsResult = await dbPool.query(merchantsQuery);

    for (const merchant of merchantsResult.rows) {
      await registerCarrierServiceForShop(merchant.shop_domain, merchant.access_token);
    }
  } catch (error) {
    console.error("CARRIER SERVICE CREATE ERROR", error);
  }
}

async function exchangeShopifyAccessToken({ shop, code }) {
  const apiKey = process.env.SHOPIFY_API_KEY || "";
  const apiSecret = process.env.SHOPIFY_API_SECRET || "";

  if (!shop || !code || !apiKey || !apiSecret) {
    return "";
  }

  const tokenEndpoint = `https://${shop}/admin/oauth/access_token`;
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code
    })
  });

  if (!response.ok) {
    throw new Error(`token_exchange_failed_${response.status}`);
  }

  const payload = await response.json();
  return String(payload?.access_token || "");
}

function isFatalDbError(error) {
  const code = String(error?.code || "");
  return (
    code.startsWith("08") ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03" ||
    code === "53300"
  );
}

async function runNonCriticalSchemaQuery(sql, label) {
  try {
    await dbPool.query(sql);
  } catch (error) {
    console.error(`DB SCHEMA NON-CRITICAL ${label}`, error);
    if (isFatalDbError(error)) {
      throw error;
    }
  }
}

function parseBasicAuthCredentials(req) {
  const authorizationHeader = String(req.get("authorization") || "");
  if (!authorizationHeader.startsWith("Basic ")) {
    return null;
  }

  const encodedCredentials = authorizationHeader.slice("Basic ".length).trim();
  if (!encodedCredentials) {
    return null;
  }

  try {
    const decodedCredentials = Buffer.from(encodedCredentials, "base64").toString("utf8");
    const separatorIndex = decodedCredentials.indexOf(":");
    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decodedCredentials.slice(0, separatorIndex),
      password: decodedCredentials.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

function getBundleAdminAuthStatus(req) {
  const expectedUsername = String(process.env.ADMIN_USERNAME || "");
  const expectedPassword = String(process.env.ADMIN_PASSWORD || "");
  const parsedCredentials = parseBasicAuthCredentials(req);

  if (!expectedUsername || !expectedPassword) {
    return { authorized: false, reason: "missing_admin_env" };
  }
  if (!parsedCredentials) {
    return { authorized: false, reason: "missing_or_invalid_basic_auth" };
  }
  if (
    parsedCredentials.username !== expectedUsername ||
    parsedCredentials.password !== expectedPassword
  ) {
    return { authorized: false, reason: "credentials_mismatch" };
  }
  return { authorized: true, reason: "ok" };
}

function sendBundleAdminAuthChallenge(req, res) {
  res.set("WWW-Authenticate", 'Basic realm="BundleCart Admin", charset="UTF-8"');
  if (String(req.originalUrl || "").startsWith("/api/")) {
    res.status(401).json({ ok: false, message: "Unauthorized" });
    return;
  }
  res.status(401).send("Unauthorized");
}

function requireBundleAdminAuth(req, res, next) {
  const authStatus = getBundleAdminAuthStatus(req);
  if (authStatus.authorized) {
    console.log("BUNDLE ADMIN AUTH SUCCESS", req.originalUrl || req.path);
    next();
    return;
  }

  console.log("BUNDLE ADMIN AUTH FAIL", req.originalUrl || req.path, authStatus.reason);
  sendBundleAdminAuthChallenge(req, res);
}

export async function ensureOrdersTableExists() {
  if (!dbPool) {
    console.warn("DATABASE_URL not set; shopify_orders persistence disabled.");
    return;
  }

  await dbPool.query(CREATE_SHOPIFY_ORDERS_TABLE_SQL);
  await dbPool.query(CREATE_SHOPIFY_ORDER_UNIQUES_SQL);
}

export async function ensureLinkingTablesExist() {
  if (!dbPool) {
    console.warn("DATABASE_URL not set; linking persistence disabled.");
    return;
  }

  await dbPool.query(CREATE_MERCHANTS_TABLE_SQL);
  await runNonCriticalSchemaQuery(ALTER_MERCHANTS_ADD_DOMAIN_SQL, "merchants add domain");
  await runNonCriticalSchemaQuery(
    ALTER_MERCHANTS_ADD_LAST_WEBHOOK_AT_SQL,
    "merchants add last_webhook_at"
  );
  await runNonCriticalSchemaQuery(ALTER_MERCHANTS_ADD_NAME_SQL, "merchants add name");
  await runNonCriticalSchemaQuery(
    ALTER_MERCHANTS_ADD_IS_ACTIVE_SQL,
    "merchants add is_active"
  );
  await runNonCriticalSchemaQuery(
    ALTER_MERCHANTS_ADD_CREATED_AT_SQL,
    "merchants add created_at"
  );
  await runNonCriticalSchemaQuery(
    ALTER_MERCHANTS_ADD_ACCESS_TOKEN_SQL,
    "merchants add access_token"
  );
  await runNonCriticalSchemaQuery(
    ALTER_MERCHANTS_ADD_UPDATED_AT_SQL,
    "merchants add updated_at"
  );
  await runNonCriticalSchemaQuery(
    ALTER_MERCHANTS_ADD_MERCHANT_COUNTRY_CODE_SQL,
    "merchants add merchant_country_code"
  );
  await runNonCriticalSchemaQuery(
    ALTER_MERCHANTS_ADD_MERCHANT_REGION_SQL,
    "merchants add merchant_region"
  );
  await runNonCriticalSchemaQuery(
    BACKFILL_MERCHANT_DOMAIN_FROM_SHOP_DOMAIN_SQL,
    "merchants backfill domain from shop_domain"
  );
  await dbPool.query(CREATE_MERCHANTS_DOMAIN_UNIQUE_INDEX_SQL);
  console.log("DB SCHEMA OK merchants");

  console.log("MIGRATION START link_groups");
  try {
    await dbPool.query(CREATE_LINK_GROUPS_TABLE_SQL);
    await dbPool.query(ALTER_LINK_GROUPS_ADD_EMAIL_SQL);
    await dbPool.query(ALTER_LINK_GROUPS_ADD_CREATED_AT_SQL);
    await dbPool.query(ALTER_LINK_GROUPS_ADD_LAST_SEEN_AT_SQL);
    await dbPool.query(ALTER_LINK_GROUPS_ADD_ACTIVE_UNTIL_SQL);
    await dbPool.query(ALTER_LINK_GROUPS_ADD_ADDRESS_HASH_SQL);
    await dbPool.query(ALTER_LINK_GROUPS_ADD_BUNDLECART_PAID_AT_SQL);
    await dbPool.query(ALTER_LINK_GROUPS_ADD_FIRST_PAID_ORDER_ID_SQL);
    await dbPool.query(ALTER_LINK_GROUPS_ADD_FIRST_SHOP_DOMAIN_SQL);
    await dbPool.query(ALTER_LINK_GROUPS_ADD_CUSTOMER_ADDRESS_JSON_SQL);
    await dbPool.query(ALTER_LINK_GROUPS_ADD_REMINDER_EMAIL_SENT_SQL);
    await dbPool.query(ALTER_LINK_GROUPS_ADD_EXPIRED_EMAIL_SENT_SQL);
    await dbPool.query(BACKFILL_LINK_GROUPS_FIRST_SHOP_DOMAIN_SQL);
    await dbPool.query(CREATE_LINK_GROUPS_INDEX_SQL);
    console.log("MIGRATION DONE link_groups");
    console.log("DB SCHEMA OK link_groups");
  } catch (error) {
    console.error("MIGRATION ERROR link_groups", error);
  }

  console.log("MIGRATION START linked_orders");
  try {
    await dbPool.query(CREATE_LINKED_ORDERS_TABLE_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_GROUP_ID_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_SHOP_DOMAIN_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_SHOPIFY_ORDER_ID_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_EMAIL_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_BUNDLECART_SELECTED_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_BUNDLECART_PAID_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_BUNDLECART_FEE_AMOUNT_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_ADDRESS_HASH_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_CREATED_AT_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_INSERTED_AT_SQL);
    await dbPool.query(CREATE_LINKED_ORDERS_UNIQUE_INDEX_SQL);
    console.log("MIGRATION DONE linked_orders");
    console.log("DB SCHEMA OK linked_orders");
  } catch (error) {
    console.error("MIGRATION ERROR linked_orders", error);
  }
}

export async function ensureBillingTablesExist() {
  if (!dbPool) {
    console.warn("DATABASE_URL not set; bundlecart billing persistence disabled.");
    return;
  }

  console.log("MIGRATION START bundlecart_billing");
  try {
    await dbPool.query(CREATE_BUNDLECART_BILLING_TABLE_SQL);
    await dbPool.query(ALTER_BUNDLECART_BILLING_ADD_APP_SUBSCRIPTION_ID_SQL);
    await dbPool.query(ALTER_BUNDLECART_BILLING_ADD_LINE_ITEM_ID_SQL);
    await dbPool.query(ALTER_BUNDLECART_BILLING_ADD_IDEMPOTENCY_KEY_SQL);
    await dbPool.query(ALTER_BUNDLECART_BILLING_ADD_BILLING_MODE_SQL);
    await dbPool.query(ALTER_BUNDLECART_BILLING_ADD_FAILURE_REASON_SQL);
    await dbPool.query(CREATE_BUNDLECART_BILLING_UNIQUE_INDEX_SQL);
    await dbPool.query(CREATE_BUNDLECART_BILLING_IDEMPOTENCY_UNIQUE_INDEX_SQL);
    console.log("MIGRATION DONE bundlecart_billing");
    console.log("DB SCHEMA OK bundlecart_billing");
  } catch (error) {
    console.error("MIGRATION ERROR bundlecart_billing", error);
    if (isFatalDbError(error)) {
      throw error;
    }
  }
}

export async function ensureMerchantBillingSubscriptionsTableExists() {
  if (!dbPool) {
    console.warn("DATABASE_URL not set; merchant subscription persistence disabled.");
    return;
  }

  console.log("MIGRATION START merchant_billing_subscriptions");
  try {
    await dbPool.query(CREATE_MERCHANT_BILLING_SUBSCRIPTIONS_TABLE_SQL);
    await dbPool.query(ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_APP_SUBSCRIPTION_ID_SQL);
    await dbPool.query(ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_LINE_ITEM_ID_SQL);
    await dbPool.query(ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_BILLING_MODE_SQL);
    await dbPool.query(ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_CAPPED_AMOUNT_SQL);
    await dbPool.query(ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_SUBSCRIPTION_STATUS_SQL);
    await dbPool.query(ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_CONFIRMATION_URL_SQL);
    await dbPool.query(ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_LAST_ERROR_SQL);
    await dbPool.query(ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_CREATED_AT_SQL);
    await dbPool.query(ALTER_MERCHANT_BILLING_SUBSCRIPTIONS_ADD_UPDATED_AT_SQL);
    await dbPool.query(CREATE_MERCHANT_BILLING_SUBSCRIPTIONS_SHOP_UNIQUE_INDEX_SQL);
    console.log("MIGRATION DONE merchant_billing_subscriptions");
    console.log("DB SCHEMA OK merchant_billing_subscriptions");
  } catch (error) {
    console.error("MIGRATION ERROR merchant_billing_subscriptions", error);
    if (isFatalDbError(error)) {
      throw error;
    }
  }
}

async function saveOrderCreateWebhookAsync({ shopDomain, webhookId, order, rawPayload }) {
  if (!dbPool) {
    return;
  }

  if (order?.id == null) {
    return;
  }

  const normalizedShopDomain =
    typeof shopDomain === "string" ? shopDomain.trim() : "";
  const orderId = String(order.id);
  const email =
    typeof order.email === "string" && order.email.trim()
      ? order.email.trim().toLowerCase()
      : "";
  const createdAt = order.created_at || null;
  const totalPrice = order.total_price != null ? String(order.total_price) : null;
  const paidAtTimestamp = createdAt || new Date().toISOString();
  const shippingAddress = getOrderShippingAddress(order);
  const { canonical: canonicalAddress, hasRequired: hasRequiredAddress } = buildCanonicalAddress(shippingAddress);
  const addressHash = hasRequiredAddress ? hashAddressCanonical(canonicalAddress) : "";
  console.log("BUNDLECART WEBHOOK CANONICAL ADDRESS", canonicalAddress);
  const bundleCartSelection = extractBundleCartSelection(order);
  const bundlecartSelected = bundleCartSelection.selected;
  const bundlecartFeeAmount = Number(bundleCartSelection.amount || 0);
  const orderCurrency = normalizeCurrencyCode(order.currency || "USD");
  const customerFeeConfirmed = isBundleCartPaidFiveUsd({
    amount: bundlecartFeeAmount,
    currency: orderCurrency
  });
  console.log("BUNDLECART WEBHOOK EMAIL", email || "");
  console.log("BUNDLECART WEBHOOK ADDRESS INPUT", JSON.stringify(shippingAddress || {}));
  console.log("BUNDLECART WEBHOOK ADDRESS HASH", addressHash || "");
  if (bundlecartSelected) {
    console.log("BUNDLECART ORDER DETECTED", {
      orderId,
      shopDomain: normalizedShopDomain,
      bundlecart_fee_amount: bundlecartFeeAmount,
      currency: orderCurrency
    });
    if (customerFeeConfirmed) {
      console.log("BUNDLECART CUSTOMER FEE CONFIRMED", orderId, bundlecartFeeAmount, orderCurrency);
    }
  }
  let bundleStartedEmailGroupId = null;
  let bundleOrderAddedEmailGroupId = null;

  if (!normalizedShopDomain) {
    console.log("MERCHANT SKIPPED missing shop_domain");
  } else {
    console.log("DB STEP merchants upsert");
    await dbPool.query(UPSERT_MERCHANT_SQL, [normalizedShopDomain]);
    console.log("MERCHANT UPSERTED", normalizedShopDomain);
  }

  if (bundlecartSelected) {
    if (!addressHash) {
      console.log("BUNDLECART ADDRESS MISMATCH");
    } else {
      let groupId = null;
      let existingWindowFound = false;

      console.log("DB STEP link_groups select active_by_address");
      const activeGroupResult = await dbPool.query(SELECT_ACTIVE_BUNDLE_GROUP_BY_ADDRESS_SQL, [
        addressHash
      ]);
      if (activeGroupResult.rowCount > 0) {
        existingWindowFound = true;
        groupId = activeGroupResult.rows[0].id;
        console.log("BUNDLECART EXISTING BUNDLE WINDOW FOUND", groupId);
        console.log("BUNDLECART ORDER LINKED TO EXISTING GROUP", orderId, groupId);
        console.log("BUNDLECART NETWORK LINKED ORDER FREE");
        await dbPool.query(UPDATE_LINK_GROUP_LAST_SEEN_SQL, [groupId]);
        await dbPool.query(UPDATE_LINK_GROUP_METADATA_SQL, [
          groupId,
          JSON.stringify(shippingAddress || {})
        ]);
        console.log("BUNDLECART CUSTOMER ADDRESS STORED");
      } else {
        const latestGroupResult = await dbPool.query(SELECT_LATEST_BUNDLE_GROUP_BY_ADDRESS_SQL, [
          addressHash
        ]);
        if (latestGroupResult.rowCount > 0) {
          const latestActiveUntil = latestGroupResult.rows[0].active_until;
          if (latestActiveUntil && new Date(latestActiveUntil).getTime() <= Date.now()) {
            console.log("BUNDLECART WINDOW EXPIRED, STARTING NEW BUNDLE");
          }
        }

        console.log("DB STEP link_groups insert");
        const createGroupResult = await dbPool.query(INSERT_LINK_GROUP_SQL, [email || ""]);
        groupId = createGroupResult.rows[0].id;
        console.log("BUNDLECART NEW BUNDLE WINDOW CREATED", groupId);
        console.log("BUNDLECART NETWORK FIRST ORDER FEE 5");
        await dbPool.query(START_BUNDLECART_WINDOW_SQL, [
          groupId,
          paidAtTimestamp,
          addressHash,
          orderId,
          normalizedShopDomain
        ]);
        await dbPool.query(UPDATE_LINK_GROUP_METADATA_SQL, [
          groupId,
          JSON.stringify(shippingAddress || {})
        ]);
        console.log("BUNDLECART CUSTOMER ADDRESS STORED");
      }

      if (groupId != null) {
        console.log("DB STEP linked_orders insert");
        const linkedOrderInsertResult = await dbPool.query(INSERT_LINKED_ORDER_SQL, [
          groupId,
          normalizedShopDomain,
          orderId,
          email || null,
          true,
          !existingWindowFound,
          bundlecartFeeAmount,
          addressHash,
          createdAt
        ]);
        if (linkedOrderInsertResult.rowCount > 0) {
          console.log("LINKED_ORDER INSERTED", orderId, groupId);
          console.log("BUNDLECART BUNDLE LINKED", orderId, groupId);
          if (existingWindowFound) {
            bundleOrderAddedEmailGroupId = groupId;
          } else {
            bundleStartedEmailGroupId = groupId;
            if (customerFeeConfirmed) {
              try {
                await processBundlecartMerchantBilling({
                  shopDomain: normalizedShopDomain,
                  bundleId: groupId,
                  orderId,
                  amount: 5
                });
              } catch (billingError) {
                console.error("BUNDLECART BILLING FAILED", normalizedShopDomain, groupId, orderId, billingError);
              }
            }
          }
        } else {
          console.log("LINKED_ORDER DUPLICATE", orderId);
        }
      }
    }
  } else {
    let groupId = null;
    if (!email) {
      console.log("LINK SKIPPED no email", orderId);
    } else {
      console.log("DB STEP link_groups select");
      const existingGroupResult = await dbPool.query(SELECT_RECENT_LINK_GROUP_SQL, [email]);
      if (existingGroupResult.rowCount > 0) {
        groupId = existingGroupResult.rows[0].id;
        console.log("DB STEP link_groups update");
        await dbPool.query(UPDATE_LINK_GROUP_LAST_SEEN_SQL, [groupId]);
        console.log("LINK GROUP REUSED", groupId);
      } else {
        console.log("DB STEP link_groups insert");
        const createGroupResult = await dbPool.query(INSERT_LINK_GROUP_SQL, [email]);
        groupId = createGroupResult.rows[0].id;
        console.log("LINK GROUP CREATED", groupId);
      }

      console.log("DB STEP linked_orders insert");
      const linkedOrderInsertResult = await dbPool.query(INSERT_LINKED_ORDER_SQL, [
        groupId,
        normalizedShopDomain,
        orderId,
        email,
        false,
        false,
        0,
        addressHash || null,
        createdAt
      ]);

      if (linkedOrderInsertResult.rowCount > 0) {
        console.log("LINKED_ORDER INSERTED", orderId, groupId);
      } else {
        console.log("LINKED_ORDER DUPLICATE", orderId);
      }
    }
  }

  if (bundleStartedEmailGroupId != null) {
    await sendBundleStartedEmailNotification(bundleStartedEmailGroupId, email);
  }
  if (bundleOrderAddedEmailGroupId != null) {
    await sendBundleOrderAddedEmailNotification(bundleOrderAddedEmailGroupId, email);
  }
  console.log("DB STEP shopify_orders insert");
  const result = await dbPool.query(INSERT_SHOPIFY_ORDER_SQL, [
    normalizedShopDomain,
    orderId,
    order.email || null,
    createdAt,
    totalPrice,
    order.currency || null,
    webhookId || null,
    rawPayload
  ]);

  if (result.rowCount > 0) {
    console.log(`ORDER SAVED id=${orderId} shop=${shopDomain}`);
  } else {
    console.log("ORDER DUPLICATE IGNORED");
  }
}

export function createApp() {
  const app = express();

  // Capture raw body only for webhook routes (required for HMAC validation).
  app.use("/api/webhooks", express.raw({ type: "*/*", limit: "2mb" }));

  app.get("/api/webhooks/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.post("/api/webhooks/orders-create", (req, res) => {
    try {
      console.log("WEBHOOK HIT");
      console.log(
        "WEBHOOK HEADERS",
        req.headers["x-shopify-hmac-sha256"] || req.headers["X-Shopify-Hmac-Sha256"],
        "len",
        req.body?.length
      );

      const hmacSignature =
        req.get("X-Shopify-Hmac-Sha256") || req.get("x-shopify-hmac-sha256") || "";
      const secret = process.env.SHOPIFY_WEBHOOK_SECRET || "";

      if (!isValidShopifyWebhookSignature(req.body, hmacSignature, secret)) {
        console.log("WEBHOOK SIG FAIL");
        res.status(401).json({ ok: false, error: "Invalid webhook signature" });
        return;
      }
      console.log("WEBHOOK SIG OK");

      let payload;
      try {
        payload = JSON.parse(req.body.toString("utf8"));
      } catch {
        res.status(400).json({ ok: false, error: "Invalid JSON payload" });
        return;
      }

      const order = payload?.order || payload || {};
      console.log("BUNDLECART SHIPPING RAW", JSON.stringify(order.shipping_lines || []));
      console.log(
        "BUNDLECART TOTAL SHIPPING LINES",
        (order.shipping_lines || []).length
      );
      const shopDomainHeader =
        req.headers["x-shopify-shop-domain"] ||
        req.headers["X-Shopify-Shop-Domain"];
      const shopDomain = Array.isArray(shopDomainHeader)
        ? String(shopDomainHeader[0] || "")
        : String(shopDomainHeader || "");
      const webhookId =
        req.get("X-Shopify-Webhook-Id") || req.get("x-shopify-webhook-id") || "";

      console.log(
        `WEBHOOK orders/create received id=${order?.id ?? ""} email=${order?.email ?? ""} created_at=${order?.created_at ?? ""} total_price=${order?.total_price ?? ""} shop=${shopDomain}`
      );

      res.status(200).json({ ok: true });

      // Persist asynchronously so webhook responses are not delayed.
      void (async () => {
        try {
          await saveOrderCreateWebhookAsync({
            shopDomain,
            webhookId,
            order,
            rawPayload: payload
          });
        } catch (err) {
          console.error("WEBHOOK DB ERROR", err);
        }
      })();
    } catch (err) {
      console.error("WEBHOOK ERROR", err);
      return res.status(500).json({ ok: false });
    }
  });

  app.post("/api/shipping/rates", express.text({ type: "*/*" }), (req, res) => {
    const fallbackPaid = () => {
      console.log("BUNDLECART RATE RETURNED 5 USD");
      return res.status(200).json(
        buildBundleCartRateResponse({ eligibleFree: false, currency: "USD" })
      );
    };

    void (async () => {
      let parsedPayload = {};
      try {
        const shopDomainHeader =
          req.get("x-shopify-shop-domain") || req.get("X-Shopify-Shop-Domain") || "";

        if (typeof req.body === "string" && req.body.trim()) {
          try {
            parsedPayload = JSON.parse(req.body);
          } catch {
            parsedPayload = {};
          }
        } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
          try {
            parsedPayload = JSON.parse(req.body.toString("utf8"));
          } catch {
            parsedPayload = {};
          }
        } else if (req.body && typeof req.body === "object") {
          parsedPayload = req.body;
        }

        const keys =
          parsedPayload && typeof parsedPayload === "object" && !Array.isArray(parsedPayload)
            ? Object.keys(parsedPayload)
            : [];
        console.log("BUNDLECART RATE REQUEST", {
          keys,
          shop_domain: normalizeShopDomain(shopDomainHeader)
        });

        const rate = parsedPayload?.rate && typeof parsedPayload.rate === "object" ? parsedPayload.rate : {};
        const destination = rate.destination && typeof rate.destination === "object" ? rate.destination : {};
        console.log("BUNDLECART RATE RAW", JSON.stringify(rate || {}));
        const { canonical, hasRequired } = buildCanonicalAddress(destination);
        const addressHash = hasRequired ? hashAddressCanonical(canonical) : "";
        console.log("BUNDLECART RATE CANONICAL ADDRESS", canonical);
        const currency = destination.currency || rate.currency || "USD";
        console.log("BUNDLECART RATE ADDRESS INPUT", JSON.stringify(destination || {}));
        console.log("BUNDLECART RATE ADDRESS HASH", addressHash || "");
        console.log("BUNDLECART RATE ELIGIBILITY QUERY PARAMS", { addressHash });
        console.log("BUNDLECART ADDRESS-ONLY ELIGIBILITY", { addressHash });

        if (!addressHash || !dbPool) {
          console.log("BUNDLECART NETWORK FIRST ORDER FEE 5");
          console.log("BUNDLECART RATE RETURNED 5 USD");
          return res
            .status(200)
            .json(buildBundleCartRateResponse({ eligibleFree: false, currency }));
        }

        const activeGroupResult = await dbPool.query(SELECT_ACTIVE_BUNDLE_GROUP_BY_ADDRESS_SQL, [
          addressHash
        ]);
        if (activeGroupResult.rowCount > 0) {
          const activeGroupId = activeGroupResult.rows[0].id;
          console.log("BUNDLECART EXISTING BUNDLE WINDOW FOUND", activeGroupId);
          console.log("BUNDLECART NETWORK LINKED ORDER FREE");
          return res
            .status(200)
            .json(buildBundleCartRateResponse({ eligibleFree: true, currency }));
        }

        const latestGroupResult = await dbPool.query(SELECT_LATEST_BUNDLE_GROUP_BY_ADDRESS_SQL, [
          addressHash
        ]);
        if (latestGroupResult.rowCount > 0) {
          const latestActiveUntil = latestGroupResult.rows[0].active_until;
          if (latestActiveUntil && new Date(latestActiveUntil).getTime() <= Date.now()) {
            console.log("BUNDLECART WINDOW EXPIRED, STARTING NEW BUNDLE");
          }
        }

        console.log("BUNDLECART NETWORK FIRST ORDER FEE 5");
        console.log("BUNDLECART RATE RETURNED 5 USD");
        return res
          .status(200)
          .json(buildBundleCartRateResponse({ eligibleFree: false, currency }));
      } catch (error) {
        console.error("BUNDLECART RATE REQUEST ERROR", error);
        return fallbackPaid();
      }
    })();
  });

  app.get("/auth", (req, res) => {
    console.log("AUTH START", req.query.shop || "");
    const shop = normalizeShopDomain(req.query.shop);
    if (!shop) {
      res.status(400).json({ ok: false, error: "Missing shop" });
      return;
    }

    const clientId = process.env.SHOPIFY_API_KEY || "";
    const scope = process.env.SHOPIFY_SCOPES || "read_orders,write_shipping";
    const redirectUri =
      process.env.REDIRECT_URL ||
      `${process.env.APP_URL || "https://bundle-cart.replit.app"}/auth/callback`;
    const state = crypto.randomBytes(16).toString("hex");

    const authorizeUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("scope", scope);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("state", state);

    res.redirect(authorizeUrl.toString());
  });

  app.get("/auth/callback", async (req, res) => {
    console.log("AUTH CALLBACK START");
    const shop = normalizeShopDomain(req.query.shop);
    const code = typeof req.query.code === "string" ? req.query.code : "";
    console.log("AUTH CALLBACK SHOP", shop);

    if (!shop || !code) {
      res.status(400).json({ ok: false, error: "Missing shop or code" });
      return;
    }

    let accessToken = "";
    try {
      accessToken = await exchangeShopifyAccessToken({ shop, code });
      if (!accessToken) {
        throw new Error("empty_access_token");
      }
      console.log("AUTH CALLBACK TOKEN RECEIVED");
    } catch (error) {
      console.error("AUTH CALLBACK TOKEN EXCHANGE ERROR", error);
      res.status(502).json({ ok: false, error: "Token exchange failed" });
      return;
    }

    console.log("MERCHANT TOKEN SAVE START", shop);
    let subscriptionCheckResult = null;
    try {
      if (!dbPool) {
        throw new Error("DATABASE_URL not configured");
      }
      await dbPool.query(UPSERT_MERCHANT_TOKEN_SQL, [shop, accessToken]);
      console.log("MERCHANT TOKEN SAVE OK", shop);
      await checkShopifyWriteOrdersScope(shop, accessToken);

      try {
        await registerCarrierServiceForShop(shop, accessToken);
      } catch (error) {
        console.error("CARRIER SERVICE CREATE ERROR", shop, error);
      }

      subscriptionCheckResult = await ensureMerchantBillingSubscription({
        shopDomain: shop,
        accessToken,
        createIfMissing: true
      });
    } catch (error) {
      console.error("MERCHANT TOKEN SAVE ERROR", error);
    }

    if (subscriptionCheckResult?.approvalRequired && subscriptionCheckResult?.confirmationUrl) {
      console.log("BUNDLECART REDIRECTING TO BILLING", shop, subscriptionCheckResult.confirmationUrl);
      res.redirect(subscriptionCheckResult.confirmationUrl);
      return;
    }

    res.redirect(`/dashboard?shop=${encodeURIComponent(shop)}`);
  });

  app.get("/billing/subscribe", async (req, res) => {
    const shop = normalizeShopDomain(req.query.shop);
    if (!shop) {
      res.status(400).json({ ok: false, error: "Missing shop" });
      return;
    }
    if (!dbPool) {
      res.status(503).json({ ok: false, error: "Database unavailable" });
      return;
    }

    try {
      const merchantResult = await dbPool.query(SELECT_MERCHANT_ACCESS_TOKEN_SQL, [shop]);
      const accessToken = String(merchantResult.rows[0]?.access_token || "").trim();
      if (!accessToken) {
        res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
        return;
      }

      const subscriptionResult = await ensureMerchantBillingSubscription({
        shopDomain: shop,
        accessToken,
        createIfMissing: true
      });

      if (subscriptionResult?.approvalRequired && subscriptionResult?.confirmationUrl) {
        console.log("BUNDLECART REDIRECTING TO BILLING", shop, subscriptionResult.confirmationUrl);
        res.redirect(subscriptionResult.confirmationUrl);
        return;
      }

      if (subscriptionResult?.active) {
        console.log("BUNDLECART BILLING ACTIVE", shop);
        res.redirect(`/dashboard?shop=${encodeURIComponent(shop)}`);
        return;
      }

      res.status(200).json({
        ok: false,
        reason: subscriptionResult?.reason || "subscription_not_ready"
      });
    } catch (error) {
      console.error("BUNDLECART SUBSCRIPTION CREATE FAILED", shop, error);
      res.status(500).json({ ok: false, error: "Subscription setup failed" });
    }
  });

  app.get("/billing/callback", async (req, res) => {
    const shop = normalizeShopDomain(req.query.shop);
    if (!shop || !dbPool) {
      res.redirect("/");
      return;
    }

    try {
      const merchantResult = await dbPool.query(SELECT_MERCHANT_ACCESS_TOKEN_SQL, [shop]);
      const accessToken = String(merchantResult.rows[0]?.access_token || "").trim();
      if (!accessToken) {
        res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
        return;
      }

      const subscriptionResult = await ensureMerchantBillingSubscription({
        shopDomain: shop,
        accessToken,
        createIfMissing: false
      });

      if (subscriptionResult?.approvalRequired && subscriptionResult?.confirmationUrl) {
        console.log("BUNDLECART REDIRECTING TO BILLING", shop, subscriptionResult.confirmationUrl);
        res.redirect(subscriptionResult.confirmationUrl);
        return;
      }
      if (subscriptionResult?.active) {
        console.log("BUNDLECART BILLING ACTIVE", shop);
      }
    } catch (error) {
      console.error("BUNDLECART SUBSCRIPTION CREATE FAILED", shop, error);
    }

    res.redirect(`/dashboard?shop=${encodeURIComponent(shop)}`);
  });

  app.post("/internal/billing/retry", express.json(), async (req, res) => {
    const bodyLimit = Number(req.body?.limit);
    const queryLimit =
      typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : Array.isArray(req.query.limit)
          ? Number(req.query.limit[0])
          : Number.NaN;
    const limit = Number.isFinite(bodyLimit)
      ? bodyLimit
      : Number.isFinite(queryLimit)
        ? queryLimit
        : 100;

    try {
      const result = await retryFailedBundlecartBilling({ limit });
      res.status(200).json(result);
    } catch (error) {
      console.error("BUNDLECART BILLING RETRY FAILED", {
        endpoint: "/internal/billing/retry",
        error: toBillingFailureReason(error)
      });
      res.status(500).json({ ok: false });
    }
  });

  app.get("/dashboard", async (req, res) => {
    const accessCheck = await enforceBundlecartBillingAccess(req, res);
    if (!accessCheck.allowed) {
      return;
    }
    res.sendFile(path.join(DIST_PATH, "index.html"));
  });

  app.use("/api", express.json());
  app.use("/api/admin", requireBundleAdminAuth);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.get("/api/merchant/dashboard", async (req, res) => {
    const shop = normalizeShopDomain(req.query.shop);
    if (!shop) {
      res.status(400).json({ ok: false, message: "Missing shop" });
      return;
    }

    if (!dbPool) {
      res.status(503).json({ ok: false, message: "Database unavailable" });
      return;
    }

    try {
      const merchantResult = await dbPool.query(SELECT_MERCHANT_ACCESS_TOKEN_SQL, [shop]);
      const accessToken = String(merchantResult.rows[0]?.access_token || "").trim();
      if (!accessToken) {
        res.status(401).json({ ok: false, message: "Merchant auth required" });
        return;
      }

      const billingAccess = await ensureMerchantBillingSubscription({
        shopDomain: shop,
        accessToken,
        createIfMissing: true
      });

      if (!billingAccess?.active) {
        res.status(402).json({
          ok: false,
          message: "Active subscription required",
          approval_url: billingAccess?.confirmationUrl || null
        });
        return;
      }

      const result = await dbPool.query(SELECT_MERCHANT_DASHBOARD_METRICS_SQL, [shop]);
      const row = result.rows[0] || {};
      res.json({
        bundles_created: Number(row.bundles_created || 0),
        orders_bundled: Number(row.orders_bundled || 0),
        extra_orders_generated: Number(row.extra_orders_generated || 0),
        network_orders: Number(row.network_orders || 0),
        avg_orders_per_bundle: Number(row.avg_orders_per_bundle || 0),
        bundlecart_fees_collected: Number(row.bundlecart_fees_collected || 0)
      });
    } catch (error) {
      console.error("MERCHANT DASHBOARD FETCH ERROR", shop, error);
      res.status(500).json({ ok: false, message: "Dashboard fetch failed" });
    }
  });

  app.get("/api/admin/bundles", async (req, res) => {
    console.log("BUNDLE DASHBOARD FETCH");

    if (!dbPool) {
      res.json({ bundles: [] });
      return;
    }

    try {
      const result = await dbPool.query(SELECT_ADMIN_BUNDLES_SQL);
      res.json({ bundles: result.rows });
    } catch (error) {
      console.error("BUNDLE DASHBOARD FETCH ERROR", error);
      res.status(500).json({ bundles: [] });
    }
  });

  app.get("/api/admin/bundles/ready", async (req, res) => {
    console.log("BUNDLE READY FETCH");

    if (!dbPool) {
      res.json({ bundles: [] });
      return;
    }

    try {
      const result = await dbPool.query(SELECT_ADMIN_BUNDLES_READY_SQL);
      res.json({ bundles: result.rows });
    } catch (error) {
      console.error("BUNDLE READY FETCH ERROR", error);
      res.status(500).json({ bundles: [] });
    }
  });

  app.get("/api/admin/bundles/:id", async (req, res) => {
    const bundleId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(bundleId) || bundleId <= 0) {
      res.status(400).json({ ok: false, message: "Invalid bundle id" });
      return;
    }

    console.log("BUNDLE DETAIL FETCH", bundleId);

    if (!dbPool) {
      res.status(404).json({ ok: false, message: "Bundle not found" });
      return;
    }

    try {
      const [bundleResult, ordersResult] = await Promise.all([
        dbPool.query(SELECT_ADMIN_BUNDLE_DETAIL_SQL, [bundleId]),
        dbPool.query(SELECT_ADMIN_LINKED_ORDERS_FOR_BUNDLE_SQL, [bundleId])
      ]);

      const bundle = bundleResult.rows[0];
      if (!bundle) {
        res.status(404).json({ ok: false, message: "Bundle not found" });
        return;
      }

      res.json({
        bundle,
        orders: ordersResult.rows
      });
    } catch (error) {
      console.error("BUNDLE DETAIL FETCH ERROR", error);
      res.status(500).json({ ok: false });
    }
  });

  app.get("/api/debug/linked-orders", async (req, res) => {
    const expectedKey = process.env.SESSION_SECRET || "";
    const providedKey =
      typeof req.query.key === "string" ? req.query.key : Array.isArray(req.query.key) ? req.query.key[0] : "";

    if (!expectedKey || providedKey !== expectedKey) {
      res.status(401).json({ ok: false });
      return;
    }

    const requestedEmail =
      typeof req.query.email === "string"
        ? req.query.email.trim().toLowerCase()
        : Array.isArray(req.query.email)
          ? String(req.query.email[0] || "").trim().toLowerCase()
          : "";

    if (!requestedEmail || !dbPool) {
      res.json([]);
      return;
    }

    try {
      const result = await dbPool.query(SELECT_DEBUG_LINKED_ORDERS_BY_EMAIL_SQL, [requestedEmail]);
      res.json(result.rows);
    } catch (error) {
      console.error("DEBUG LINKED_ORDERS ERROR", error);
      res.status(500).json({ ok: false });
    }
  });

  app.get("/api/debug/carrier-services", async (_req, res) => {
    if (!dbPool) {
      res.json({ merchants: [] });
      return;
    }

    try {
      const merchantsResult = await dbPool.query(
        "SELECT domain AS shop_domain, access_token FROM merchants WHERE is_active = TRUE AND access_token IS NOT NULL AND access_token <> '' LIMIT 200"
      );

      const results = [];
      for (const merchant of merchantsResult.rows) {
        const normalizedShop = normalizeShopDomain(merchant.shop_domain);
        const token = String(merchant.access_token || "").trim();
        const entry = {
          shop_domain: normalizedShop,
          succeeded: false,
          carrier_service_names: [],
          callback_urls: []
        };

        if (!normalizedShop || !token) {
          console.log("DEBUG CARRIER SERVICES", normalizedShop || "(missing)", 0);
          results.push(entry);
          continue;
        }

        try {
          const endpoint = `https://${normalizedShop}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/carrier_services.json`;
          const response = await fetch(endpoint, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "X-Shopify-Access-Token": token
            }
          });

          if (!response.ok) {
            entry.error = `status_${response.status}`;
          } else {
            let payload = {};
            try {
              payload = await response.json();
            } catch {
              payload = {};
            }
            const carrierServices = Array.isArray(payload?.carrier_services)
              ? payload.carrier_services
              : [];
            entry.succeeded = true;
            entry.carrier_service_names = carrierServices.map((service) => service?.name).filter(Boolean);
            entry.callback_urls = carrierServices
              .map((service) => service?.callback_url)
              .filter(Boolean);
          }
        } catch (error) {
          entry.error = error?.message || "request_failed";
        }

        console.log("DEBUG CARRIER SERVICES", normalizedShop, entry.carrier_service_names.length);
        results.push(entry);
      }

      res.json({ merchants: results });
    } catch (error) {
      console.error("DEBUG CARRIER SERVICES ERROR", error);
      res.status(500).json({ merchants: [] });
    }
  });

  app.get("/api/debug/merchants", async (_req, res) => {
    if (!dbPool) {
      res.json({ merchants: [] });
      return;
    }

    try {
      const result = await dbPool.query(SELECT_DEBUG_MERCHANTS_SQL);
      const merchants = result.rows.map((row) => ({
        domain: row.domain,
        is_active: row.is_active,
        token_present: Boolean(row.access_token),
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
      res.json({ merchants });
    } catch (error) {
      console.error("DEBUG MERCHANTS ERROR", error);
      res.status(500).json({ merchants: [] });
    }
  });

  app.get("/api/debug/schema", async (_req, res) => {
    if (!dbPool) {
      res.json({ merchants: [], link_groups: [], linked_orders: [] });
      return;
    }

    try {
      const [merchantsResult, linkGroupsResult, linkedOrdersResult] = await Promise.all([
        dbPool.query(SELECT_TABLE_COLUMNS_SQL, ["merchants"]),
        dbPool.query(SELECT_TABLE_COLUMNS_SQL, ["link_groups"]),
        dbPool.query(SELECT_TABLE_COLUMNS_SQL, ["linked_orders"])
      ]);

      res.json({
        merchants: merchantsResult.rows.map((row) => row.column_name),
        link_groups: linkGroupsResult.rows.map((row) => row.column_name),
        linked_orders: linkedOrdersResult.rows.map((row) => row.column_name)
      });
    } catch (error) {
      console.error("DEBUG SCHEMA ERROR", error);
      res.status(500).json({ merchants: [], link_groups: [], linked_orders: [] });
    }
  });

  app.get("/app-config.js", (_req, res) => {
    const appUrl = process.env.APP_URL || "";
    const redirectUrl = process.env.REDIRECT_URL || `${appUrl}/auth/callback`;
    const config = JSON.stringify({
      APP_URL: appUrl,
      REDIRECT_URL: redirectUrl
    });

    res
      .type("application/javascript")
      .send(
        `window.__BUNDLECART_CONFIG__ = ${config}; window.APP_CONFIG = window.__BUNDLECART_CONFIG__;`
      );
  });

  app.get("/admin/bundles", requireBundleAdminAuth, async (req, res) => {
    const accessCheck = await enforceBundlecartBillingAccess(req, res, { allowMissingShop: true });
    if (!accessCheck.allowed) {
      return;
    }
    res.sendFile(path.join(DIST_PATH, "index.html"));
  });

  app.get("/admin/bundles/:id", requireBundleAdminAuth, async (req, res) => {
    const accessCheck = await enforceBundlecartBillingAccess(req, res, { allowMissingShop: true });
    if (!accessCheck.allowed) {
      return;
    }
    res.sendFile(path.join(DIST_PATH, "index.html"));
  });

  app.get("/", async (req, res) => {
    const accessCheck = await enforceBundlecartBillingAccess(req, res, { allowMissingShop: true });
    if (!accessCheck.allowed) {
      return;
    }
    if (!accessCheck.shop) {
      res.status(200).send("ok");
      return;
    }
    const shop = accessCheck.shop;
    console.log("APP ROOT AUTHORIZED", shop);
    res.redirect(`/dashboard?shop=${encodeURIComponent(shop)}`);
  });

  app.use(express.static(DIST_PATH));

  app.get("/{*any}", (_req, res) => {
    res.sendFile(path.join(DIST_PATH, "index.html"));
  });

  return app;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun && process.env.NODE_ENV !== "test") {
  ensureOrdersTableExists()
    .then(() => ensureLinkingTablesExist())
    .then(() => ensureBillingTablesExist())
    .then(() => ensureMerchantBillingSubscriptionsTableExists())
    .catch((error) => {
      console.error("Failed to ensure shopify_orders table", error?.message || error);
    })
    .finally(() => {
      const app = createApp();
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`BundleCart server listening on port ${PORT}`);
        void registerCarrierServiceForActiveMerchants();
        startBundleLifecycleEmailWorker();
      });
    });
}
