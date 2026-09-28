# FrigoCold WMS

Kevin's tablet and office UI, now backed by PostgreSQL. The app records deliveries as kilogram balances on shipments and records each sale as immutable stock movements. Product, supplier, client, shipment, sale, draft, and alert settings are shared across signed-in browsers.

## Local setup

1. Run PostgreSQL 16 or later. You can use an existing service, or run `docker compose up -d db` to start one on port 5433.
2. Create a separate `frigocold_demo` database and copy `.env.example` to `.env`. Point `DATABASE_URL` at that database, set a random `SESSION_SECRET` of at least 32 characters, and set your initial username/password. If using Docker Compose, also set `POSTGRES_PASSWORD` to match the password in `DATABASE_URL`. Do not deploy the example values. An existing PostgreSQL service on port 5432 can use a URL such as `postgresql://USER:PASSWORD@localhost:5432/frigocold_demo?schema=public`. For hosted databases, use the pooled URL as `DATABASE_URL` and the direct URL as `DIRECT_URL` when available.
3. Run:

```bash
npm install
npm run db:deploy
npm run db:seed
npm run dev
```

Open `http://localhost:3000` and sign in with the username and password you set. For a disposable demonstration database, run `npm run db:seed -- --demo` instead of the plain seed. The demo seed can only run while product data is empty. It uses historical sample dates, so date-based dashboard figures move as the calendar advances.

`npm run db:deploy` must be run whenever new migrations are shipped, before the new app version handles traffic. Back up production PostgreSQL before deploying migrations. The Docker Compose file runs the **database only**; it does not deploy the app.

For Vercel and hosted PostgreSQL, follow [the deployment runbook](docs/vercel-deployment.md). Prisma Migrate already owns the schema; no second migration tool is needed.

## What the backend does

- `/api/auth/login` and `/api/auth/logout` use hashed passwords and an HTTP-only, signed, 12-hour session cookie. Failed logins are throttled per IP/username.
- `/api/browse` provides authenticated, filtered, sorted, paginated clients, suppliers, active inventory, movement history, and cross-entity search. Page size is capped at 100.
- `/api/dashboard` and `/api/accounting` calculate dashboard and finance views on the server. Dashboard detail sections are bounded to their leading rows; the finance lot table returns 25 rows per page.
- `/api/nav` returns alert and draft counts without loading all records into the browser.
- `/api/state` remains the authenticated full projection used by receiving, sales, detail, alerts, and settings screens. Those screens refresh on focus and every 15 seconds while visible.
- `/api/commands` handles product, supplier, client, shipment, draft, sale, and alert-setting writes. It validates inputs on the server.
- Receiving creates a shipment, supplier lot allocations, and an `IN` movement together.
- A sale can contain several products and shipments. The server verifies weights, locks the affected shipments, checks remaining kilograms and unit counts, then creates the sale and its `OUT` movements in one transaction. Stock is derived from the append-only ledger.
- Receiving and sale submissions include a request ID. Retrying an identical submission returns its original record instead of creating a duplicate.
- Prices and totals are calculated from stored weights and per-kilogram prices; the server does not trust totals sent by the browser.

The UI no longer reads or writes `localStorage`. Data previously saved in the browser under `frigocold-demo-v1` is **not imported automatically**. This database is also independent of the older `frigocold-wms` database; moving existing WMS data requires a deliberate migration and reconciliation of stock balances.

## Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Current boundaries

This backend supports the demo's actual receiving and sales workflow, which records a shipment total at arrival and individual carton or pallet weights at sale time. It does not implement the older WMS's carton QR label, AI photo scan, write-off, or recall screens. Supplier lots are stored on a shipment, but a sale draws from the shipment balance; a multi-lot shipment therefore needs conservative shipment-level recall. List and report pages now receive bounded responses, but the receiving, sales, detail, alert, and settings flows still use the full `/api/state` projection. Server reports also currently read the full dataset before calculating aggregates; SQL-level aggregates and focused workflow queries are the next scaling step.
