import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import { fileURLToPath } from "node:url";
import pg from "pg";

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
  total_price: "995",
  description: "BundleCart shipping"
};
const BUNDLECART_FREE_RATE = {
  service_name: "BundleCart",
  service_code: "BUNDLECART_FREE",
  total_price: "0",
  description: "BundleCart free shipping"
};
const BUNDLECART_REGION_WAREHOUSES = {
  US: {
    name: "BundleCart US Warehouse",
    address1: "21-38 44th Road",
    city: "Long Island City",
    province: "NY",
    zip: "11101",
    country: "United States",
    country_code: "US"
  },
  UK: {
    name: "BundleCart UK Warehouse",
    address1: "1 Placeholder Street",
    city: "London",
    province: "",
    zip: "SW1A 1AA",
    country: "United Kingdom",
    country_code: "GB"
  },
  EU: {
    name: "BundleCart EU Warehouse",
    address1: "10 Placeholder Avenue",
    city: "Amsterdam",
    province: "",
    zip: "1012 AB",
    country: "Netherlands",
    country_code: "NL"
  },
  ASIA: {
    name: "BundleCart Asia Warehouse",
    address1: "88 Placeholder Road",
    city: "Singapore",
    province: "",
    zip: "049213",
    country: "Singapore",
    country_code: "SG"
  },
  SA: {
    name: "BundleCart SA Warehouse",
    address1: "100 Placeholder Blvd",
    city: "Sao Paulo",
    province: "",
    zip: "01000-000",
    country: "Brazil",
    country_code: "BR"
  }
};

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
  merchant_region TEXT,
  warehouse_region TEXT,
  warehouse_address_json JSONB,
  location_id BIGINT
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
  customer_address_json JSONB,
  warehouse_region TEXT,
  warehouse_address_json JSONB
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
  address_hash TEXT,
  warehouse_region TEXT,
  warehouse_address_json JSONB,
  created_at TIMESTAMP,
  inserted_at TIMESTAMP DEFAULT NOW()
);
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
  merchant_region = COALESCE(EXCLUDED.merchant_region, merchants.merchant_region),
  warehouse_region = COALESCE(EXCLUDED.warehouse_region, merchants.warehouse_region),
  warehouse_address_json = COALESCE(EXCLUDED.warehouse_address_json, merchants.warehouse_address_json);
`;

const UPDATE_MERCHANT_REGION_ASSIGNMENT_SQL = `
UPDATE merchants
SET merchant_country_code = $1::text,
    merchant_region = $2::text,
    warehouse_region = $3::text,
    warehouse_address_json = $4::jsonb,
    location_id = $5::bigint,
    updated_at = NOW()
WHERE domain = $6::text;
`;

const SELECT_MERCHANT_WAREHOUSE_SQL = `
SELECT domain, warehouse_region, warehouse_address_json, access_token
FROM merchants
WHERE domain = $1::text
LIMIT 1;
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
  $7::text,
  $8::timestamp
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

const UPDATE_LINK_GROUP_METADATA_SQL = `
UPDATE link_groups
SET customer_address_json = $2::jsonb,
    warehouse_region = $3::text,
    warehouse_address_json = $4::jsonb
WHERE id = $1::integer;
`;

const UPDATE_LINKED_ORDER_METADATA_SQL = `
UPDATE linked_orders
SET warehouse_region = $3::text,
    warehouse_address_json = $4::jsonb
WHERE shop_domain = $1::text
  AND shopify_order_id = $2::bigint;
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

const SELECT_ADMIN_BUNDLES_SQL = `
SELECT
  lg.id,
  lg.email,
  lg.customer_address_json,
  lg.warehouse_region,
  lg.warehouse_address_json,
  lg.bundlecart_paid_at,
  lg.active_until,
  CASE
    WHEN lg.active_until IS NOT NULL AND lg.active_until <= NOW() THEN 'READY_TO_SHIP'
    ELSE 'OPEN'
  END AS bundle_status,
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
  lg.warehouse_region,
  lg.warehouse_address_json,
  lg.bundlecart_paid_at,
  lg.active_until,
  CASE
    WHEN lg.active_until IS NOT NULL AND lg.active_until <= NOW() THEN 'READY_TO_SHIP'
    ELSE 'OPEN'
  END AS bundle_status,
  COUNT(lo.id) AS order_count
FROM link_groups lg
LEFT JOIN linked_orders lo
  ON lo.group_id = lg.id
WHERE lg.active_until IS NOT NULL
  AND lg.active_until <= NOW()
GROUP BY lg.id
ORDER BY lg.created_at DESC
LIMIT 100;
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

const ALTER_MERCHANTS_ADD_WAREHOUSE_REGION_SQL = `
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS warehouse_region TEXT;
`;

const ALTER_MERCHANTS_ADD_WAREHOUSE_ADDRESS_JSON_SQL = `
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS warehouse_address_json JSONB;
`;

const ALTER_MERCHANTS_ADD_LOCATION_ID_SQL = `
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS location_id BIGINT;
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

const ALTER_LINK_GROUPS_ADD_CUSTOMER_ADDRESS_JSON_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS customer_address_json JSONB;
`;

const ALTER_LINK_GROUPS_ADD_WAREHOUSE_REGION_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS warehouse_region TEXT;
`;

const ALTER_LINK_GROUPS_ADD_WAREHOUSE_ADDRESS_JSON_SQL = `
ALTER TABLE link_groups ADD COLUMN IF NOT EXISTS warehouse_address_json JSONB;
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

const ALTER_LINKED_ORDERS_ADD_ADDRESS_HASH_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS address_hash TEXT;
`;

const ALTER_LINKED_ORDERS_ADD_WAREHOUSE_REGION_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS warehouse_region TEXT;
`;

const ALTER_LINKED_ORDERS_ADD_WAREHOUSE_ADDRESS_JSON_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS warehouse_address_json JSONB;
`;

const ALTER_LINKED_ORDERS_ADD_CREATED_AT_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
`;

const ALTER_LINKED_ORDERS_ADD_INSERTED_AT_SQL = `
ALTER TABLE linked_orders ADD COLUMN IF NOT EXISTS inserted_at TIMESTAMP DEFAULT NOW();
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

const COUNTRY_NAME_TO_CODE = {
  "united states": "US",
  usa: "US",
  us: "US",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  singapore: "SG",
  brazil: "BR",
  netherlands: "NL",
  canada: "CA",
  mexico: "MX"
};

const REGION_US_CODES = new Set(["US", "CA", "MX"]);
const REGION_UK_CODES = new Set(["GB"]);
const REGION_EU_CODES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE"
]);
const REGION_ASIA_CODES = new Set([
  "SG",
  "JP",
  "HK",
  "CN",
  "KR",
  "IN",
  "TH",
  "MY",
  "ID",
  "VN",
  "PH"
]);
const REGION_SA_CODES = new Set([
  "BR",
  "AR",
  "CL",
  "CO",
  "PE",
  "UY",
  "PY",
  "BO",
  "EC",
  "VE"
]);

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

function normalizeCountryCodeToIso(value) {
  const normalized = normalizeAddressValue(value);
  if (!normalized) {
    return "";
  }
  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }
  return COUNTRY_NAME_TO_CODE[normalized] || "";
}

function mapCountryCodeToRegion(countryCodeInput) {
  const countryCode = String(countryCodeInput || "").trim().toUpperCase();
  if (!countryCode) {
    return "US";
  }
  if (REGION_US_CODES.has(countryCode)) {
    return "US";
  }
  if (REGION_UK_CODES.has(countryCode)) {
    return "UK";
  }
  if (REGION_EU_CODES.has(countryCode)) {
    return "EU";
  }
  if (REGION_ASIA_CODES.has(countryCode)) {
    return "ASIA";
  }
  if (REGION_SA_CODES.has(countryCode)) {
    return "SA";
  }
  return "US";
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

function getWarehouseForRegion(region) {
  return BUNDLECART_REGION_WAREHOUSES[region] || BUNDLECART_REGION_WAREHOUSES.US;
}

async function detectMerchantRegion(shopDomain, accessToken) {
  const normalizedShop = normalizeShopDomain(shopDomain);
  const token = String(accessToken || "").trim();
  if (!normalizedShop || !token) {
    return { countryCode: "US", region: "US", locationId: null };
  }

  const headers = {
    Accept: "application/json",
    "X-Shopify-Access-Token": token
  };

  try {
    const locationsResponse = await fetch(
      `https://${normalizedShop}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/locations.json`,
      { method: "GET", headers }
    );
    if (locationsResponse.ok) {
      const locationsPayload = await locationsResponse.json();
      const locations = Array.isArray(locationsPayload?.locations)
        ? locationsPayload.locations
        : [];
      const location = locations.find(
        (item) =>
          item &&
          item.active !== false &&
          (item.country_code || item.country || item.province_code || item.province)
      );
      if (location) {
        const countryCode = normalizeCountryCodeToIso(
          location.country_code || location.country
        );
        const region = mapCountryCodeToRegion(countryCode);
        return {
          countryCode: countryCode || "US",
          region,
          locationId:
            location.id != null
              ? Number.parseInt(String(location.id), 10) || null
              : null
        };
      }
    }
  } catch (error) {
    console.error("MERCHANT REGION DETECT ERROR", normalizedShop, error);
  }

  try {
    const shopResponse = await fetch(
      `https://${normalizedShop}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/shop.json`,
      { method: "GET", headers }
    );
    if (shopResponse.ok) {
      const shopPayload = await shopResponse.json();
      const countryCode = normalizeCountryCodeToIso(
        shopPayload?.shop?.country_code || shopPayload?.shop?.country
      );
      const region = mapCountryCodeToRegion(countryCode);
      return {
        countryCode: countryCode || "US",
        region,
        locationId: null
      };
    }
  } catch (error) {
    console.error("MERCHANT REGION DETECT ERROR", normalizedShop, error);
  }

  return { countryCode: "US", region: "US", locationId: null };
}

async function updateOrderShippingAddressToWarehouse(
  shopDomain,
  accessToken,
  shopifyOrderId,
  warehouseAddress,
  customerName
) {
  const normalizedShop = normalizeShopDomain(shopDomain);
  const token = String(accessToken || "").trim();
  const orderId = String(shopifyOrderId || "").trim();

  if (!normalizedShop || !token || !orderId || !warehouseAddress) {
    throw new Error("missing_rewrite_parameters");
  }

  const countryCode =
    normalizeCountryCodeToIso(warehouseAddress.country_code || warehouseAddress.country) || "";
  const parsedOrderId = Number.parseInt(orderId, 10);
  const orderReference = Number.isFinite(parsedOrderId) ? parsedOrderId : orderId;
  const normalizedCustomerName = String(customerName || "").trim();
  const companyLabel = normalizedCustomerName
    ? `BundleCart | ${normalizedCustomerName}`
    : "BundleCart Shipment";
  console.log("BUNDLECART LABEL MARKER APPLIED", normalizedShop, orderId);

  const endpoint = `https://${normalizedShop}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/orders/${orderId}.json`;
  const payload = {
    order: {
      id: orderReference,
      shipping_address: {
        first_name: "BundleCart",
        last_name: "Warehouse",
        company: companyLabel,
        address1: warehouseAddress.address1 || "",
        address2: warehouseAddress.address2 || "",
        city: warehouseAddress.city || "",
        province: warehouseAddress.province || "",
        zip: warehouseAddress.zip || "",
        country: warehouseAddress.country || "",
        country_code: countryCode,
        phone: warehouseAddress.phone || ""
      }
    }
  };

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let details = "";
    try {
      details = await response.text();
    } catch {
      details = "";
    }
    throw new Error(`status_${response.status} ${details}`.trim());
  }
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

function isAdminDashboardAuthorized(req) {
  const expectedToken = String(process.env.ADMIN_DASHBOARD_TOKEN || "");
  const providedToken = String(req.get("X-ADMIN-TOKEN") || "");
  if (!expectedToken || !providedToken) {
    return false;
  }
  return providedToken === expectedToken;
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
    ALTER_MERCHANTS_ADD_WAREHOUSE_REGION_SQL,
    "merchants add warehouse_region"
  );
  await runNonCriticalSchemaQuery(
    ALTER_MERCHANTS_ADD_WAREHOUSE_ADDRESS_JSON_SQL,
    "merchants add warehouse_address_json"
  );
  await runNonCriticalSchemaQuery(
    ALTER_MERCHANTS_ADD_LOCATION_ID_SQL,
    "merchants add location_id"
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
    await dbPool.query(ALTER_LINK_GROUPS_ADD_CUSTOMER_ADDRESS_JSON_SQL);
    await dbPool.query(ALTER_LINK_GROUPS_ADD_WAREHOUSE_REGION_SQL);
    await dbPool.query(ALTER_LINK_GROUPS_ADD_WAREHOUSE_ADDRESS_JSON_SQL);
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
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_ADDRESS_HASH_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_WAREHOUSE_REGION_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_WAREHOUSE_ADDRESS_JSON_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_CREATED_AT_SQL);
    await dbPool.query(ALTER_LINKED_ORDERS_ADD_INSERTED_AT_SQL);
    await dbPool.query(CREATE_LINKED_ORDERS_UNIQUE_INDEX_SQL);
    console.log("MIGRATION DONE linked_orders");
    console.log("DB SCHEMA OK linked_orders");
  } catch (error) {
    console.error("MIGRATION ERROR linked_orders", error);
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
  const customerName = String(
    shippingAddress?.name ||
      order?.customer?.default_address?.name ||
      [order?.customer?.first_name, order?.customer?.last_name].filter(Boolean).join(" ") ||
      ""
  ).trim();
  const { canonical: canonicalAddress, hasRequired: hasRequiredAddress } = buildCanonicalAddress(shippingAddress);
  const addressHash = hasRequiredAddress ? hashAddressCanonical(canonicalAddress) : "";
  console.log("BUNDLECART WEBHOOK CANONICAL ADDRESS", canonicalAddress);
  const bundleCartSelection = extractBundleCartSelection(order);
  const bundlecartSelected = bundleCartSelection.selected;
  console.log("BUNDLECART WEBHOOK EMAIL", email || "");
  console.log("BUNDLECART WEBHOOK ADDRESS INPUT", JSON.stringify(shippingAddress || {}));
  console.log("BUNDLECART WEBHOOK ADDRESS HASH", addressHash || "");
  let warehouseRegion = "US";
  let warehouseAddress = getWarehouseForRegion("US");
  let runtimeWarehouseAssigned = false;
  let merchantFound = false;
  let merchantDomain = "";
  let hasWarehouseAddress = false;
  let hasAccessToken = false;
  let merchantAccessToken = "";
  let linkedOrderPersistenceDone = false;

  if (!normalizedShopDomain) {
    console.log("MERCHANT SKIPPED missing shop_domain");
  } else {
    console.log("DB STEP merchants upsert");
    await dbPool.query(UPSERT_MERCHANT_SQL, [normalizedShopDomain]);
    console.log("MERCHANT UPSERTED", normalizedShopDomain);
    try {
      const merchantWarehouseResult = await dbPool.query(SELECT_MERCHANT_WAREHOUSE_SQL, [
        normalizedShopDomain
      ]);
      if (merchantWarehouseResult.rowCount > 0) {
        merchantFound = true;
        const row = merchantWarehouseResult.rows[0];
        merchantDomain = String(row?.domain || normalizedShopDomain);
        merchantAccessToken = String(row?.access_token || "").trim();
        hasAccessToken = Boolean(merchantAccessToken);
        hasWarehouseAddress = Boolean(row?.warehouse_address_json);
        const dbRegion = String(row?.warehouse_region || "").toUpperCase();
        if (dbRegion) {
          warehouseRegion = dbRegion;
        }
      }
    } catch (error) {
      console.error("MERCHANT WAREHOUSE LOAD ERROR", normalizedShopDomain, error);
    }
  }

  console.log("BUNDLECART REWRITE MERCHANT LOOKUP", {
    domain: merchantDomain || normalizedShopDomain || "",
    token_present: hasAccessToken,
    warehouse_region: warehouseRegion || "",
    warehouse_address_present: hasWarehouseAddress
  });
  console.log(
    "BUNDLECART REWRITE TOKEN STATUS",
    normalizedShopDomain,
    hasAccessToken
  );

  if (bundlecartSelected) {
    runtimeWarehouseAssigned =
      Boolean(warehouseAddress) && typeof warehouseAddress === "object";
    console.log("BUNDLECART WAREHOUSE ASSIGNED", normalizedShopDomain, warehouseRegion);
    console.log("BUNDLECART WAREHOUSE ADDRESS", safeJsonString(warehouseAddress));
    if (bundleCartSelection.paid) {
      if (!email) {
        console.log("LINK SKIPPED no email", orderId);
      } else if (!addressHash) {
        console.log("BUNDLECART ADDRESS MISMATCH");
      } else {
        let groupId = null;
        console.log("DB STEP link_groups select");
        const matchingGroupResult = await dbPool.query(SELECT_MATCHING_GROUP_FOR_PAID_SQL, [
          email,
          addressHash
        ]);
        if (matchingGroupResult.rowCount > 0) {
          groupId = matchingGroupResult.rows[0].id;
          console.log("LINK GROUP REUSED", groupId);
        } else {
          console.log("DB STEP link_groups insert");
          const createGroupResult = await dbPool.query(INSERT_LINK_GROUP_SQL, [email]);
          groupId = createGroupResult.rows[0].id;
          console.log("LINK GROUP CREATED", groupId);
        }

        console.log("DB STEP link_groups update");
        console.log("BUNDLECART PAID WINDOW PARAMS", {
          groupId,
          paidAt: paidAtTimestamp,
          addressHash,
          orderId
        });
        await dbPool.query(UPDATE_BUNDLECART_PAID_GROUP_SQL, [
          groupId,
          paidAtTimestamp,
          addressHash,
          orderId
        ]);
        await dbPool.query(UPDATE_LINK_GROUP_METADATA_SQL, [
          groupId,
          JSON.stringify(shippingAddress || {}),
          warehouseRegion,
          JSON.stringify(warehouseAddress || {})
        ]);
        console.log("BUNDLECART CUSTOMER ADDRESS STORED");
        console.log("BUNDLECART PAID WINDOW STARTED");

        console.log("DB STEP linked_orders insert");
        const linkedOrderInsertResult = await dbPool.query(INSERT_LINKED_ORDER_SQL, [
          groupId,
          normalizedShopDomain,
          orderId,
          email,
          true,
          true,
          addressHash,
          createdAt
        ]);
        if (linkedOrderInsertResult.rowCount > 0) {
          console.log("LINKED_ORDER INSERTED", orderId, groupId);
        } else {
          console.log("LINKED_ORDER DUPLICATE", orderId);
        }
        await dbPool.query(UPDATE_LINKED_ORDER_METADATA_SQL, [
          normalizedShopDomain,
          orderId,
          warehouseRegion,
          JSON.stringify(warehouseAddress || {})
        ]);
      }
    } else if (bundleCartSelection.free) {
      if (!email) {
        console.log("LINK SKIPPED no email", orderId);
        console.log("BUNDLECART FREE ORDER REJECTED");
      } else if (!addressHash) {
        console.log("BUNDLECART ADDRESS MISMATCH");
        console.log("BUNDLECART FREE ORDER REJECTED");
      } else {
        console.log("DB STEP link_groups select");
        const eligibleGroupResult = await dbPool.query(SELECT_ELIGIBLE_BUNDLECART_GROUP_SQL, [
          email,
          addressHash
        ]);
        if (eligibleGroupResult.rowCount > 0) {
          const groupId = eligibleGroupResult.rows[0].id;
          console.log("DB STEP link_groups update");
          await dbPool.query(UPDATE_LINK_GROUP_LAST_SEEN_SQL, [groupId]);
          await dbPool.query(UPDATE_LINK_GROUP_METADATA_SQL, [
            groupId,
            JSON.stringify(shippingAddress || {}),
            warehouseRegion,
            JSON.stringify(warehouseAddress || {})
          ]);
          console.log("BUNDLECART CUSTOMER ADDRESS STORED");
          console.log("BUNDLECART FREE ORDER ACCEPTED");
          console.log("DB STEP linked_orders insert");
          const linkedOrderInsertResult = await dbPool.query(INSERT_LINKED_ORDER_SQL, [
            groupId,
            normalizedShopDomain,
            orderId,
            email,
            true,
            false,
            addressHash,
            createdAt
          ]);
          if (linkedOrderInsertResult.rowCount > 0) {
            console.log("LINKED_ORDER INSERTED", orderId, groupId);
          } else {
            console.log("LINKED_ORDER DUPLICATE", orderId);
          }
          await dbPool.query(UPDATE_LINKED_ORDER_METADATA_SQL, [
            normalizedShopDomain,
            orderId,
            warehouseRegion,
            JSON.stringify(warehouseAddress || {})
          ]);
        } else {
          const addressOnlyEligibleResult = await dbPool.query(
            SELECT_ELIGIBLE_BUNDLECART_GROUP_BY_ADDRESS_SQL,
            [addressHash]
          );

          if (addressOnlyEligibleResult.rowCount > 0) {
            const groupId = addressOnlyEligibleResult.rows[0].id;
            const groupEmail = String(addressOnlyEligibleResult.rows[0].email || "");
            if (groupEmail && groupEmail !== email) {
              console.log("BUNDLECART EMAIL DIFFERENCE ON FREE ORDER");
            }
            console.log("DB STEP link_groups update");
            await dbPool.query(UPDATE_LINK_GROUP_LAST_SEEN_SQL, [groupId]);
            await dbPool.query(UPDATE_LINK_GROUP_METADATA_SQL, [
              groupId,
              JSON.stringify(shippingAddress || {}),
              warehouseRegion,
              JSON.stringify(warehouseAddress || {})
            ]);
            console.log("BUNDLECART CUSTOMER ADDRESS STORED");
            console.log("BUNDLECART FREE ORDER ACCEPTED");
            console.log("DB STEP linked_orders insert");
            const linkedOrderInsertResult = await dbPool.query(INSERT_LINKED_ORDER_SQL, [
              groupId,
              normalizedShopDomain,
              orderId,
              email,
              true,
              false,
              addressHash,
              createdAt
            ]);
            if (linkedOrderInsertResult.rowCount > 0) {
              console.log("LINKED_ORDER INSERTED", orderId, groupId);
            } else {
              console.log("LINKED_ORDER DUPLICATE", orderId);
            }
            await dbPool.query(UPDATE_LINKED_ORDER_METADATA_SQL, [
              normalizedShopDomain,
              orderId,
              warehouseRegion,
              JSON.stringify(warehouseAddress || {})
            ]);
          } else {
            const mismatchResult = await dbPool.query(SELECT_ADDRESS_MISMATCH_ACTIVE_GROUP_SQL, [
              email,
              addressHash
            ]);
            if (mismatchResult.rowCount > 0) {
              console.log("BUNDLECART ADDRESS MISMATCH");
            }
            console.log("BUNDLECART FREE ORDER REJECTED");
          }
        }
      }
    }
    linkedOrderPersistenceDone = true;
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

  const hasWarehouseAddressFromRuntime =
    runtimeWarehouseAssigned &&
    Boolean(warehouseAddress) &&
    typeof warehouseAddress === "object";
  const accessToken = merchantAccessToken;
  try {
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
  } finally {
    if (bundlecartSelected) {
      console.log("BUNDLECART POST-PERSIST START", normalizedShopDomain, orderId);
      console.log(
        "BUNDLECART POST-PERSIST LINKED_ORDER_DONE",
        normalizedShopDomain,
        orderId
      );
      console.log(
        "BUNDLECART POST-PERSIST SHOPIFY_ORDER_SAVE_DONE",
        normalizedShopDomain,
        orderId
      );
      console.log("BUNDLECART REWRITE CHECK START", normalizedShopDomain, orderId);
      console.log("BUNDLECART REWRITE CHECK FLAGS", {
        bundlecartSelected,
        bundlecartPaid: bundleCartSelection.paid,
        shopDomain: normalizedShopDomain,
        orderId,
        hasWarehouseAddress: hasWarehouseAddressFromRuntime,
        hasAccessToken,
        merchantFound,
        linkedOrderPersistenceDone
      });

      if (bundlecartSelected === true && accessToken && warehouseAddress) {
        console.log(
          "BUNDLECART REWRITE USING RUNTIME WAREHOUSE",
          normalizedShopDomain,
          orderId
        );
        console.log(
          "BUNDLECART ORDER ADDRESS REWRITE INVOKE",
          normalizedShopDomain,
          orderId
        );
        console.log(
          "BUNDLECART ORDER ADDRESS REWRITE START",
          normalizedShopDomain,
          orderId
        );
        try {
          await updateOrderShippingAddressToWarehouse(
            normalizedShopDomain,
            accessToken,
            orderId,
            warehouseAddress,
            customerName
          );
          console.log(
            "BUNDLECART ORDER ADDRESS REWRITE SUCCESS",
            normalizedShopDomain,
            orderId
          );
        } catch (error) {
          console.error(
            "BUNDLECART ORDER ADDRESS REWRITE ERROR",
            normalizedShopDomain,
            orderId,
            error
          );
          const rewriteErrorMessage = String(error?.message || error || "").toLowerCase();
          if (
            rewriteErrorMessage.includes("status_403") &&
            rewriteErrorMessage.includes("write_orders")
          ) {
            console.error(
              "BUNDLECART ORDER ADDRESS REWRITE BLOCKED BY MISSING SCOPE",
              normalizedShopDomain,
              orderId,
              "write_orders"
            );
          }
        }
      }
    }
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
        const email = normalizeAddressValue(rate.email || destination.email || parsedPayload?.email);
        const { canonical, hasRequired } = buildCanonicalAddress(destination);
        const addressHash = hasRequired ? hashAddressCanonical(canonical) : "";
        console.log("BUNDLECART RATE CANONICAL ADDRESS", canonical);
        const currency = destination.currency || rate.currency || "USD";
        console.log("BUNDLECART RATE EMAIL", email || "");
        console.log("BUNDLECART RATE ADDRESS INPUT", JSON.stringify(destination || {}));
        console.log("BUNDLECART RATE ADDRESS HASH", addressHash || "");
        console.log("BUNDLECART RATE ELIGIBILITY QUERY PARAMS", { email, addressHash });
        console.log("BUNDLECART ADDRESS-ONLY ELIGIBILITY", { addressHash });

        if (!addressHash || !dbPool) {
          console.log("BUNDLECART NOT ELIGIBLE PAID BY ADDRESS");
          return res
            .status(200)
            .json(buildBundleCartRateResponse({ eligibleFree: false, currency }));
        }

        const eligibleResult = await dbPool.query(
          SELECT_ELIGIBLE_BUNDLECART_GROUP_BY_ADDRESS_SQL,
          [addressHash]
        );
        if (eligibleResult.rowCount > 0) {
          console.log("BUNDLECART ELIGIBLE FREE BY ADDRESS");
          return res
            .status(200)
            .json(buildBundleCartRateResponse({ eligibleFree: true, currency }));
        }

        const activeByEmailDebug = await dbPool.query(SELECT_ACTIVE_GROUPS_FOR_EMAIL_DEBUG_SQL, [
          email
        ]);
        console.log("BUNDLECART ACTIVE GROUPS FOR EMAIL", activeByEmailDebug.rows);
        if (
          activeByEmailDebug.rowCount > 0 &&
          activeByEmailDebug.rows.some((row) => String(row.address_hash || "") !== addressHash)
        ) {
          console.log("BUNDLECART HASH MISMATCH STORED VS RATE");
        }

        const mismatchResult = await dbPool.query(SELECT_ADDRESS_MISMATCH_ACTIVE_GROUP_SQL, [
          email,
          addressHash
        ]);
        if (mismatchResult.rowCount > 0) {
          console.log("BUNDLECART ADDRESS MISMATCH");
        }
        console.log("BUNDLECART NOT ELIGIBLE PAID BY ADDRESS");
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
    try {
      if (!dbPool) {
        throw new Error("DATABASE_URL not configured");
      }
      await dbPool.query(UPSERT_MERCHANT_TOKEN_SQL, [shop, accessToken]);
      console.log("MERCHANT TOKEN SAVE OK", shop);
      await checkShopifyWriteOrdersScope(shop, accessToken);

      try {
        const regionDetection = await detectMerchantRegion(shop, accessToken);
        const detectedRegion = regionDetection.region || "US";
        const detectedCountryCode = regionDetection.countryCode || "US";
        const warehouseAddress = getWarehouseForRegion(detectedRegion);
        await dbPool.query(UPDATE_MERCHANT_REGION_ASSIGNMENT_SQL, [
          detectedCountryCode,
          detectedRegion,
          detectedRegion,
          JSON.stringify(warehouseAddress),
          regionDetection.locationId,
          shop
        ]);
        console.log(
          "MERCHANT REGION DETECTED",
          shop,
          detectedCountryCode,
          detectedRegion
        );
        console.log("MERCHANT WAREHOUSE ASSIGNED", shop, detectedRegion);
      } catch (error) {
        console.error("MERCHANT REGION DETECT ERROR", shop, error);
      }

      try {
        await registerCarrierServiceForShop(shop, accessToken);
      } catch (error) {
        console.error("CARRIER SERVICE CREATE ERROR", shop, error);
      }
    } catch (error) {
      console.error("MERCHANT TOKEN SAVE ERROR", error);
    }

    res.redirect("/");
  });

  app.use("/api", express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.get("/api/admin/bundles", async (req, res) => {
    if (!isAdminDashboardAuthorized(req)) {
      res.status(401).json({ ok: false });
      return;
    }
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
    if (!isAdminDashboardAuthorized(req)) {
      res.status(401).json({ ok: false });
      return;
    }
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

    res.type("application/javascript").send(`window.__BUNDLECART_CONFIG__ = ${config};`);
  });

  app.get("/", async (req, res) => {
    const shop = normalizeShopDomain(req.query.shop);
    if (!shop) {
      res.status(200).send("ok");
      return;
    }

    const merchantAuth = await findMerchantAuthByShop(shop);
    if (!merchantAuth.exists || !merchantAuth.tokenPresent) {
      console.log("APP ROOT AUTH REDIRECT", shop);
      res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
      return;
    }

    console.log("APP ROOT AUTHORIZED", shop);
    res.status(200).send("ok");
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
    .catch((error) => {
      console.error("Failed to ensure shopify_orders table", error?.message || error);
    })
    .finally(() => {
      const app = createApp();
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`BundleCart server listening on port ${PORT}`);
        void registerCarrierServiceForActiveMerchants();
      });
    });
}
