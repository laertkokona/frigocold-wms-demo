import assert from "node:assert/strict";
import test from "node:test";
import { buildPeriod } from "../accounting";

test("month period uses complete calendar dates in the local timezone", () => {
  const period = buildPeriod("month");
  const [year, month] = period.from.split("-").map(Number);
  assert.equal(period.from, `${year}-${String(month).padStart(2, "0")}-01`);
  const last = new Date(year, month, 0).getDate();
  assert.equal(period.to, `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`);
});
