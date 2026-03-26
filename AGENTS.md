# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

BundleCart is a Shopify App (Node.js/Express backend + React/Vite frontend, single repo). It lets customers pay a one-time $5 fee to unlock free shipping for 72 hours across participating Shopify stores.

### Services

| Service | Command | Port | Notes |
|---|---|---|---|
| **Backend (Express)** | `node server.js` | 3000 | Serves built frontend from `dist/`, auto-creates DB tables on startup. Requires `DATABASE_URL` and env vars from `.env`. |
| **Frontend dev server (Vite)** | `npm run dev` | 5173 | HMR-enabled dev server. Only for frontend-only changes; API calls require the backend running separately. |
| **Frontend build** | `npm run build` | — | Produces `dist/` consumed by the Express server. |

### Starting the backend

PostgreSQL must be running first:

```bash
sudo pg_ctlcluster 16 main start
```

Then start the server with required env vars (a `.env` file exists but the server reads `process.env` directly, not dotenv):

```bash
export DATABASE_URL=postgresql://bundlecart:bundlecart@localhost:5432/bundlecart
export PORT=3000
export APP_URL=http://localhost:3000
export SHOPIFY_BILLING_MODE=manual
export SHOPIFY_WEBHOOK_SECRET=dev-secret
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=admin
node server.js
```

### Key gotchas

- **No dotenv**: The server does not use `dotenv`. Environment variables must be exported in the shell or passed inline before `node server.js`.
- **Admin auth**: The `/api/admin/*` and `/admin/*` routes use HTTP Basic Auth. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` env vars; without them, admin endpoints always return 401.
- **DB is optional at startup**: If `DATABASE_URL` is unset, the server starts but all persistence features (orders, bundles, merchants) are disabled. Schema migrations run automatically on startup when DB is connected.
- **No automated test suite**: The project does not include any test framework or test files. Validation is done by running the server and testing API endpoints / UI manually.
- **Frontend must be built for production server**: Run `npm run build` before `npm start` so the Express server can serve `dist/`. The Vite dev server (`npm run dev`) is only for frontend HMR development.
- **Multiple server instances**: Kill any existing `node server.js` processes before starting a new one to avoid port conflicts.

### Lint / test / build

- **Build**: `npm run build`
- **Dev**: `npm run dev` (Vite frontend only)
- **Start**: `npm start` (Express server serving built frontend)
- **Lint**: No ESLint or Prettier configured in the project.
- **Tests**: No automated tests configured.
