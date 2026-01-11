"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const express_1 = __importDefault(require("express"));
const oauth_controller_1 = require("./modules/auth/oauth.controller");
const webhook_controller_1 = require("./modules/webhooks/webhook.controller");
function registerRoutes(app) {
    app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
    app.get("/api/shopify/auth", oauth_controller_1.beginInstall);
    app.get("/api/shopify/auth/callback", oauth_controller_1.oauthCallback);
    // Webhook requests must be verified against the raw body.
    app.post("/api/webhooks", express_1.default.raw({ type: "application/json", limit: "2mb" }), webhook_controller_1.webhookReceiver);
}
