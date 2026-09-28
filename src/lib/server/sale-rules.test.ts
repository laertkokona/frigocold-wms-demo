import assert from "node:assert/strict";
import test from "node:test";
import { assertAvailable, requiredStock, StockError } from "./sale-rules";

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
