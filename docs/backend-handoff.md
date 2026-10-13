# Backend handoff: WMS to demo

## What exists in `frigocold-wms`

The older project has a mature Next.js/PostgreSQL/Prisma backend: cookie authentication, suppliers, categories, shipments, cartons, movements, reports, settings, AI label scanning, manual fallback, and several operational tests. Its original model gives each carton an internal ID and uses carton status for stock. The latest `v2: model stock as a kilogram balance on the shipment` commit adds schema for the owner's revised workflow, but `docs/decisions.md` explicitly says that migration is additive and the old receiving/outgoing routes remain in use while the rewrite proceeds. Its main `project-specifications.md` and `docs/schema.md` still describe the older carton-led process.

## Why the demo needs a different backend contract

The demo implements the revised physical process: receive a documented shipment total, allocate unit counts across supplier lots, then record carton or pallet weights when making a sale. It also records landed cost and selling price in Lek, supports a sale spanning several products and shipments, and computes management reports from those records. The older WMS's carton write APIs cannot serve those screens unchanged.

The new backend in this repository uses the revised contract. It keeps the important WMS practices: server-owned authentication, PostgreSQL, Prisma migrations, server validation, append-only movement history, derived stock, and transactional sales with overdraw protection. The database is independent of the older WMS database.

## Data and operational boundaries

- `ShipmentLot` records which supplier lots arrived, but available kilograms are held at shipment level. The system cannot say which lot in a multi-lot shipment supplied a particular sale. Recall handling must conservatively include every lot on that shipment.
- A sale line records a unit count and kilograms. The current UI assumes each selected unit leaves whole; partial pallet or carton sales would need a revised unit-count rule.
- List and search pages use bounded `/api/browse` queries, with server-side filtering and ordering. Dashboard and accounting calculations run on the server. Receiving, sales, details, alerts, and settings still use the full `/api/state` projection, and report calculations still load the full dataset on the server. Replace those reads with focused queries and SQL aggregates as record counts grow.
- The older WMS's AI extraction, internal QR labels, write-off, and recall features have not been moved into the demo. They need redesign against shipment-level stock if wanted later.
- Existing `frigocold-wms` data and browser `localStorage` demo data are not imported. An import should map identities, preserve lot and date evidence, reconcile every shipment's opening kilograms with historical outflow, and be verified before switching users to this database.

## API contract

- `POST /api/auth/login`, `POST /api/auth/logout`: session lifecycle.
- `GET /api/state`: authenticated UI projection, including derived sold kilograms and counts.
- `GET /api/browse`: filtered, sorted, paginated clients, suppliers, inventory, movements, and cross-entity search.
- `GET /api/dashboard`, `GET /api/accounting`: server-calculated summaries; accounting lots are paginated.
- `GET /api/nav`: alert and draft counts for navigation.
- `POST /api/commands`: discriminated command payload for master data, receiving, sales, drafts, and thresholds. On success it returns `{ result, state }` so the existing UI can update its store. On validation error it returns 400; on stock conflict it returns 409.

Server calculations are authoritative: the browser may show a sale total for review, but the server stores only lines, weights, and prices and derives totals when reading. A shipment row is locked before its balance is checked and `OUT` movements are inserted.
Receiving and sale requests carry an idempotency key so a repeat request after a lost response returns the original record. A key reused with different data is rejected.

## Receipt-based sales and sale dates

- Sale lines accept a fourth method, `TOTAL`, for sales registered later from a paper receipt: a unit count (cartons or pallets, following the shipment's load type) and the total kilograms, with no individual weights. The server rejects `weights`/`fixedKg` on a `TOTAL` line and applies the same kilogram and unit-count stock checks as the other methods. The movements list shows it as "totali nga fatura".
- `finalizeSale` accepts an optional `date` (ISO `yyyy-mm-dd`) so a receipt entered later is booked on the day it was sold. It defaults to today in Europe/Tirane, may not be in the future, and may not precede the entry date of any shipment on the sale (`assertSaleDate` in `sale-rules.ts`). No schema change was needed: `sale_lines.method` and `sales.date` are already text columns.

## Product categories and per-load specs (migration `20261001000000_load_specs`)

- A product is now a category (e.g. "Kofshë pule"). Categories are created and renamed on the new Produktet page (`addProduct` needs only a name; `updateProduct` renames). `products.weight_type`, `fixed_kg` and `origin` remain as legacy defaults only.
- Each load (shipment) carries its own spec: `fixed_kg` (set → fixed-weight cartons, unset carton load → variable weights, pallet load → pallets), `origin`, and free-text `specs` (brand, cut, calibre). The server rejects `fixedKg` on a pallet load. Sales recommend the weighing method from the chosen load (`loadWeightType` in `src/lib/stock.ts`).
- The migration is additive and copies the old product-level spec onto existing loads. **Run `npm run db:deploy` against each environment's database before deploying this version**: the app reads the new columns.

## Incomplete shipments (migration `20261012000000_incomplete_shipments`)

- Receiving requires a product, positive actual kg, and expiry. Entry date defaults to today in Europe/Tirane. Supplier, order number, document kg, document/actual unit counts, purchase cost and lots may be missing. Missing numeric values are `NULL`; supplied actual counts and purchase costs must be positive. Expiry ranges use their earliest date for stock rotation and alerts.
- Lots are optional. If supplied, they require a known actual count and their positive allocations must sum to it. Editing count inputs preserves entered allocations; inconsistent allocations prevent submission.
- A shipment without an opening count is tracked by kg and sold using `TOTAL`. Its sale count is optional and informative. A shipment with a known count requires counts on every sale and enforces both balances. Individual weights and fixed-weight methods require unit counts. Row locks, idempotency and append-only ledger protections remain in force.
- `updateShipmentDetails` permits supplier, order number and purchase cost edits from the shipment detail screen. It cannot change opening kg, counts, dates or movements. Purchase-cost enrichment recalculates the shipment's inventory value and historical sale economics. Adding an opening count after kg-only sales requires a separate reconciliation workflow.
- The interface derives the `Të dhëna të paplota` badge from missing supplier, order number, actual count, lots or cost. Inventory, search and movement queries retain shipments without suppliers.
- Revenue and kg reports remain complete. Any aggregate containing unknown purchase costs returns `NULL` for its complete cost/profit/margin; stock and expiry-risk reports also expose known value and kg without costs. Zero remaining/sold kg contributes zero value even when purchase cost is missing. Charts leave gaps and CSV financial cells stay blank for unknown values. Profit rankings are unavailable when contributing sales lack costs.
- Deploy the migration before promoting the updated app. The migration makes columns nullable and adjusts checks, preserving all existing receipts and movements. Avoid rolling back to app versions that assume complete shipment data after incomplete records have been created.
- Run `npm test` for the calculation/validation suite. For real PostgreSQL coverage, set `TEST_DATABASE_URL` to a disposable database and run `npm run test:integration`; it upgrades and exercises a separate schema, verifies concurrent sales and cleanup, then removes that schema.

## Cancelling a load and correcting its entry date (migration `20261013000000_cancel_shipments`)

- `cancelShipment` cancels a load entered by mistake (e.g. saved twice), only while no sale line references it. The ledger stays append-only: it appends a `CANCEL` movement reversing the `IN` movement and sets `shipments.cancelled_at`. Cancelled loads are excluded from `/api/state` and from the supplier, inventory, movement and search queries; sales from them are rejected. The migration adds the column and extends `movements_direction_check` with the `CANCEL` type; it is idempotent.
- `updateShipmentDetails` accepts `entryDate`. It may not be in the future or later than the first sale from that load.
- The integration test re-applies migrations newer than `20261012000000_incomplete_shipments` after upgrading, and covers cancellation and entry-date correction. **Run `npm run db:deploy` before deploying this version.**
