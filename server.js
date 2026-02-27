import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import { fileURLToPath } from "node:url";

const DIST_PATH = path.resolve("dist");

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

    const shopDomain =
      req.get("X-Shopify-Shop-Domain") ||
      req.get("x-shopify-shop-domain") ||
      payload?.shop_domain ||
      "";

    console.log(
      `WEBHOOK orders/create received id=${payload?.id ?? ""} email=${payload?.email ?? ""} created_at=${payload?.created_at ?? ""} total_price=${payload?.total_price ?? ""} shop=${shopDomain}`
    );

    res.status(200).json({ ok: true });
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

  app.use(express.static(DIST_PATH));

  app.get("/{*any}", (_req, res) => {
    res.sendFile(path.join(DIST_PATH, "index.html"));
  });

  return app;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun && process.env.NODE_ENV !== "test") {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`BundleCart server listening on port ${port}`);
  });
}
