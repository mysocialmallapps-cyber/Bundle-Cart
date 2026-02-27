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

  await dbPool.query(CREATE_SHOPIFY_ORDERS_TABLE_SQL);
  await dbPool.query(CREATE_SHOPIFY_ORDER_UNIQUES_SQL);
}

async function saveOrderCreateWebhookAsync({ shopDomain, webhookId, order, rawPayload }) {
  if (!dbPool) {
    return;
  }

  if (!shopDomain || order?.id == null) {
    return;
  }

  const orderId = String(order.id);
  const createdAt = order.created_at || null;
  const totalPrice = order.total_price != null ? String(order.total_price) : null;

  const result = await dbPool.query(INSERT_SHOPIFY_ORDER_SQL, [
    shopDomain,
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
    const hmacSignature =
      req.get("X-Shopify-Hmac-Sha256") || req.get("x-shopify-hmac-sha256") || "";
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET || "";

    if (!isValidShopifyWebhookSignature(req.body, hmacSignature, secret)) {
      res.status(401).json({ ok: false, error: "Invalid webhook signature" });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      res.status(400).json({ ok: false, error: "Invalid JSON payload" });
      return;
    }

    const order = payload?.order || payload || {};
    const shopDomain =
      req.get("X-Shopify-Shop-Domain") ||
      req.get("x-shopify-shop-domain") ||
      "";
    const webhookId =
      req.get("X-Shopify-Webhook-Id") || req.get("x-shopify-webhook-id") || "";

    console.log(
      `WEBHOOK orders/create received id=${order?.id ?? ""} email=${order?.email ?? ""} created_at=${order?.created_at ?? ""} total_price=${order?.total_price ?? ""} shop=${shopDomain}`
    );

    res.status(200).json({ ok: true });

    // Persist asynchronously so webhook responses are not delayed.
    void saveOrderCreateWebhookAsync({
      shopDomain,
      webhookId,
      order,
      rawPayload: payload
    }).catch((error) => {
      console.error("ORDER SAVE ERROR", error?.message || error);
    });
  });

  app.use("/api", express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
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
