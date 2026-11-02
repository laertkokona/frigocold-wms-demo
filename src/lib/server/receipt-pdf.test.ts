import assert from "node:assert/strict";
import test from "node:test";
import { receiptPdf, type ReceiptData } from "../receipt";

const data: ReceiptData = {
  number: 7, date: "2026-11-02", client: { name: "Klient Test", city: "Tiranë" },
  lines: [
    { cartons: 84, product: "Kofshe (Pule)", detail: "Arctic · Tyson", kg: 1260, pricePerKg: 195, value: 245700 },
    { cartons: null, product: "Kofshë derri", detail: "Seara", kg: 814.42, pricePerKg: 310, value: 252470.2 },
  ],
};

test("the order sheet PDF has one page per copy; only the accountant's copy names the loads", async () => {
  const both = await receiptPdf(data);
  assert.equal(both.getNumberOfPages(), 2);
  const text = both.output();
  assert.ok(text.includes("KONTABILITETI"));
  assert.ok(text.includes("Arctic"));
  const client = await receiptPdf(data, ["client"]);
  assert.equal(client.getNumberOfPages(), 1);
  assert.ok(!client.output().includes("KONTABILITETI"));
  assert.ok(!client.output().includes("Arctic"));
  assert.ok(!client.output().includes("Seara"));
});

test("many lines still fit one page per copy", async () => {
  const many = { ...data, lines: Array.from({ length: 16 }, () => data.lines[0]) };
  assert.equal((await receiptPdf(many)).getNumberOfPages(), 2);
});
