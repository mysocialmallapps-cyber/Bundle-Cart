import type { Express } from "express";
import express from "express";
import { beginInstall, oauthCallback } from "./modules/auth/oauth.controller";
import { webhookReceiver } from "./modules/webhooks/webhook.controller";
import { carrierRatesCallback } from "./modules/carrier/rates.controller";

export function registerRoutes(app: Express) {
  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

  app.get("/api/shopify/auth", beginInstall);
  app.get("/api/shopify/auth/callback", oauthCallback);

  // Webhook requests must be verified against the raw body.
  app.post(
    "/api/webhooks",
    express.raw({ type: "application/json", limit: "2mb" }),
    webhookReceiver
  );

  // Carrier service callback (do NOT use raw body; no HMAC verification is available here).
  app.post(
    "/api/carrier/rates",
    express.raw({ type: "application/json", limit: "2mb" }),
    carrierRatesCallback
  );
}

