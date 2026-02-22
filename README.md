# Bundle-Cart

## Live App Configuration

Use these values for previews, testing, and Shopify OAuth redirects:

- `APP_URL=https://bundle-cart--nathanchuku.replit.app`
- `REDIRECT_URL=https://bundle-cart--nathanchuku.replit.app/auth/callback`

## Frontend (React + Vite)

The frontend includes these pages:

- Home / Dashboard
- Bundle Management (create, edit, delete bundles)
- Orders (including cross-store orders in a 24h window)
- Customer Insights (free-shipping and discount eligibility)
- Settings / Integration (OAuth + environment visibility)

### Local development

```bash
npm install
npm run dev
```

### Production build

```bash
npm run build
```

This creates a production build in `dist/`.

## API behavior

The frontend calls backend endpoints at `/api/*`:

- `GET /api/bundles`
- `POST /api/bundles`
- `PUT /api/bundles/:id`
- `DELETE /api/bundles/:id`
- `GET /api/orders?crossStoreWindowHours=24`
- `GET /api/customers/insights`
- `GET /api/health`

The API base URL is computed from `APP_URL` and falls back to relative `/api`.

## Serve `dist/` with Express (public URL / Replit)

Use this pattern in your Express backend so the React app is publicly reachable and supports client-side routing:

```js
import path from "node:path";
import express from "express";

const app = express();
const distPath = path.resolve("dist");

app.get("/app-config.js", (_req, res) => {
  const appUrl = process.env.APP_URL || "";
  const redirectUrl = process.env.REDIRECT_URL || `${appUrl}/auth/callback`;

  res.type("application/javascript").send(
    `window.__BUNDLECART_CONFIG__ = ${JSON.stringify({
      APP_URL: process.env.APP_URL || "",
      REDIRECT_URL: process.env.REDIRECT_URL || ""
    })};`
  );
});

app.use(express.static(distPath));

// React Router fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});
```