import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import { fileURLToPath } from "node:url";
import pg from "pg";

const DIST_PATH = path.resolve("dist");
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "";
const dbPool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;

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
  name TEXT,
  domain TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
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
  last_seen_at TIMESTAMP DEFAULT NOW()
);
`;

const CREATE_LINKED_ORDERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS linked_orders (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES link_groups(id) ON DELETE CASCADE,
  shop_domain TEXT NOT NULL,
  shopify_order_id BIGINT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP,
  inserted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (shop_domain, shopify_order_id)
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
INSERT INTO merchants (domain, name, is_active, created_at)
VALUES ($1, $1, TRUE, NOW())
ON CONFLICT (domain)
DO UPDATE SET is_active = TRUE;
`;

const SELECT_RECENT_LINK_GROUP_SQL = `
SELECT id
FROM link_groups
WHERE email = $1
  AND last_seen_at >= NOW() - INTERVAL '72 hours'
ORDER BY last_seen_at DESC
LIMIT 1;
`;

const UPDATE_LINK_GROUP_LAST_SEEN_SQL = `
UPDATE link_groups
SET last_seen_at = NOW()
WHERE id = $1;
`;

const INSERT_LINK_GROUP_SQL = `
INSERT INTO link_groups (email, created_at, last_seen_at)
VALUES ($1, NOW(), NOW())
RETURNING id;
`;

const INSERT_LINKED_ORDER_SQL = `
INSERT INTO linked_orders (
  group_id,
  shop_domain,
  shopify_order_id,
  email,
  created_at
)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (shop_domain, shopify_order_id) DO NOTHING
RETURNING id;
`;

const SELECT_DEBUG_LINKED_ORDERS_BY_EMAIL_SQL = `
SELECT id, group_id, shop_domain, shopify_order_id, email, created_at, inserted_at
FROM linked_orders
WHERE email = $1
ORDER BY inserted_at DESC
LIMIT 20;
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

export async function ensureOrdersTableExists() {
  if (!dbPool) {
    console.warn("DATABASE_URL not set; shopify_orders persistence disabled.");
    return;
  }

  await dbPool.query(CREATE_MERCHANTS_TABLE_SQL);
  await dbPool.query(CREATE_MERCHANTS_DOMAIN_UNIQUE_INDEX_SQL);
  await dbPool.query(CREATE_LINK_GROUPS_TABLE_SQL);
  await dbPool.query(CREATE_LINKED_ORDERS_TABLE_SQL);
  await dbPool.query(CREATE_LINKED_ORDERS_UNIQUE_INDEX_SQL);
  await dbPool.query(CREATE_LINK_GROUPS_INDEX_SQL);
  await dbPool.query(CREATE_SHOPIFY_ORDERS_TABLE_SQL);
  await dbPool.query(CREATE_SHOPIFY_ORDER_UNIQUES_SQL);
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

  if (!normalizedShopDomain) {
    console.log("MERCHANT SKIPPED missing shop_domain");
  } else {
    console.log("DB STEP merchants upsert");
    await dbPool.query(UPSERT_MERCHANT_SQL, [normalizedShopDomain]);
    console.log("MERCHANT UPSERTED", normalizedShopDomain);
  }

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
      createdAt
    ]);

    if (linkedOrderInsertResult.rowCount > 0) {
      console.log("LINKED_ORDER INSERTED", orderId, groupId);
    } else {
      console.log("LINKED_ORDER DUPLICATE", orderId);
    }
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

  app.use("/api", express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
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

  app.get("/app-config.js", (_req, res) => {
    const appUrl = process.env.APP_URL || "";
    const redirectUrl = process.env.REDIRECT_URL || `${appUrl}/auth/callback`;
    const config = JSON.stringify({
      APP_URL: appUrl,
      REDIRECT_URL: redirectUrl
    });

    res.type("application/javascript").send(`window.__BUNDLECART_CONFIG__ = ${config};`);
  });

  app.get("/", (_req, res) => {
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
    .catch((error) => {
      console.error("Failed to ensure shopify_orders table", error?.message || error);
    })
    .finally(() => {
      const app = createApp();
      const port = Number(process.env.PORT || 3000);
      app.listen(port, () => {
        console.log(`BundleCart server listening on port ${port}`);
      });
    });
}
