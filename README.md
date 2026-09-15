# FrigoCold WMS — frontend demo

Prototype of the warehouse management system for Frigo ALBA (frozen meat import & distribution, Kashar). Front-end only: every screen runs on mocked data held in the browser, so it can be demoed, clicked through and deployed without a backend.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with **menaxher / frigocold**.

Production build: `npm run build && npm start`.

## Deploy to Vercel

Push the folder to a Git repo and import it in Vercel — no environment variables or configuration needed. Or from the CLI: `npx vercel`.

## What's in the demo

| Route | Purpose |
|---|---|
| `/login` | Single-user sign-in (cookie-based, enforced by middleware) |
| `/dashboard` | Tabbed business overview: stock & cash at risk, revenue and gross profit this month, inventory aging, turnover, client ranking and churn, supplier performance, profit by product |
| `/hyrje` | **Entry** — pick product → shipment form (order nr, supplier, cartons/pallets, document vs actual count & weight, multi-lot allocation, cost per kg/ton in Lek, fixed or range dates) → review with discrepancy warnings → save. Drafts can be saved and resumed at any point. |
| `/dalje` | **Sales** — build a multi-product order: choose shipment with FEFO guidance, then weigh by *fixed weight × count*, *fast keypad* (fixed decimal format, auto-commit, physical keyboard supported, printable weight sheet) or *pallets*; set price per kg; pick client; finalize. Stock is deducted in kg. |
| `/inventari` | Stock by product and shipment, with a detail page per shipment (doc vs actual, lots, cost, remaining, sales history, gross profit) |
| `/klientet` | Client list and per-client history with revenue and gross profit |
| `/levizjet` | Full movement log (in/out), filters, CSV export |
| `/kerko` | Global search across lot numbers, order numbers, dates, products and clients |
| `/alarmet` | Expiry, low-lot and low-product alerts driven by the thresholds in settings |
| `/cilesimet` | Alert thresholds; reset demo data |

Everything you add (shipments, sales, clients, products, drafts) persists in `localStorage` under `frigocold-demo-v1`; "Rikthe të dhënat e demos" in settings restores the seed. The demo's "today" is fixed to **15 September 2026** so the seed data stays coherent.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · shadcn-style components on Radix primitives · Lucide icons · Motion (step transitions only) · Zustand (persisted client store) · Sonner (toasts). No backend, no database, no API keys.

## Structure

```
src/
  app/                 routes (login + (app) group behind auth)
  components/ui/       button, card, input, select, dialog, tabs, switch, badge, segmented, banner
  components/          rail navigation, app shell
  lib/mock-data.ts     seed: products, suppliers, clients, shipments, sales, thresholds
  lib/store.ts         persisted store + stock helpers (remainingKg / remainingCount)
  lib/calc.ts          alerts, FEFO order, stock aging, flows, client & product analytics
  lib/types.ts         domain types
  middleware.ts        cookie auth gate
```

When wiring a real backend, the store actions (`addShipment`, `finalizeSale`, `saveDraft`, …) are the seams to replace with API calls; the pages don't touch data any other way.
