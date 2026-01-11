# BundleCart Backend

Node.js + TypeScript + Express + PostgreSQL foundation for the BundleCart Shopify app.

## Setup

1. Create `.env` (start from `.env.example`).
2. Install deps:

```bash
cd apps/backend
npm install
```

3. Run migrations:

```bash
npm run migrate
```

4. Start dev server:

```bash
npm run dev
```

## Endpoints (current)

- `GET /health`: healthcheck
- `GET /api/shopify/auth?shop=STORE.myshopify.com`: begin OAuth install
- `GET /api/shopify/auth/callback`: OAuth callback
- `POST /api/webhooks`: Shopify webhooks (HMAC verified, idempotent via `X-Shopify-Webhook-Id`)

## Notes

- Merchant access tokens are **encrypted at rest** using `ENCRYPTION_KEY_BASE64` (AES-256-GCM).
- Webhooks must be verified against the **raw request body**. We intentionally skip JSON parsing for `/api/webhooks` to avoid breaking HMAC validation.

