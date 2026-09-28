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
