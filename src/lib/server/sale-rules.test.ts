import assert from "node:assert/strict";
import test from "node:test";
import { assertAvailable, assertSaleDate, requiredStock, StockError } from "./sale-rules";

test("adds multiple sale lines against one shipment before checking stock", () => {
  const required = requiredStock([
    { shipmentId: "a", method: "VARIABLE", qty: 2, kg: 39.5, weights: [19.2, 20.3] },
    { shipmentId: "a", method: "FIXED", qty: 2, kg: 30, fixedKg: 15 },
  ]);
  assert.deepEqual(required.get("a"), { kg: 69.5, qty: 4 });
  assert.throws(() => assertAvailable(required, new Map([["a", { kg: 60, qty: 5 }]])), StockError);
  assert.doesNotThrow(() => assertAvailable(required, new Map([["a", { kg: 70, qty: 4 }]])));
});

test("rejects incorrect individual weights and excess unit count", () => {
  assert.deepEqual(requiredStock([{ shipmentId: "a", method: "VARIABLE", qty: 1, kg: 19.877, weights: [19.877] }]).get("a"), { kg: 19.877, qty: 1 });
  assert.throws(() => requiredStock([{ shipmentId: "a", method: "VARIABLE", qty: 2, kg: 39.5, weights: [19.2, 20.2] }]), StockError);
  assert.throws(() => requiredStock([{ shipmentId: "a", method: "FIXED", qty: 2, kg: 29, fixedKg: 15 }]), StockError);
  assert.throws(() => assertAvailable(new Map([["a", { kg: 20, qty: 2 }]]), new Map([["a", { kg: 100, qty: 1 }]])), StockError);
});

test("accepts receipt totals without individual weights and counts them against stock", () => {
  const required = requiredStock([
    { shipmentId: "a", method: "TOTAL", qty: 5, kg: 90.35 },
    { shipmentId: "b", method: "TOTAL", qty: 2, kg: 1604.6 },
  ]);
  assert.deepEqual(required.get("a"), { kg: 90.35, qty: 5 });
  assert.deepEqual(required.get("b"), { kg: 1604.6, qty: 2 });
  assert.throws(() => assertAvailable(required, new Map([["a", { kg: 90, qty: 10 }], ["b", { kg: 5000, qty: 9 }]])), StockError);
  assert.throws(() => requiredStock([{ shipmentId: "a", method: "TOTAL", qty: 2, kg: 40, weights: [20, 20] }]), StockError);
});

test("allows past sale dates but not future ones or ones before receipt", () => {
  assert.doesNotThrow(() => assertSaleDate("2026-09-26", "2026-09-28", ["2026-09-01", "2026-09-20"]));
  assert.doesNotThrow(() => assertSaleDate("2026-09-28", "2026-09-28", ["2026-09-28"]));
  assert.throws(() => assertSaleDate("2026-09-29", "2026-09-28", ["2026-09-01"]), StockError);
  assert.throws(() => assertSaleDate("2026-09-10", "2026-09-28", ["2026-09-01", "2026-09-20"]), StockError);
});
