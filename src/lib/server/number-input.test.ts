import assert from "node:assert/strict";
import test from "node:test";
import { toDecimalText } from "../../components/ui/input";
import { fmtKg, fmtNum } from "../utils";

test("decimal fields accept a comma or a point as the decimal separator", () => {
  assert.equal(toDecimalText("1234,65"), "1234.65");
  assert.equal(toDecimalText("1.234,5"), "1234.5");
  assert.equal(toDecimalText("1,234.5"), "1234.5");
  assert.equal(toDecimalText("23.876"), "23.876");
  assert.equal(toDecimalText("12 kg"), "12");
});

test("numbers show up to three decimals without trailing zeros", () => {
  // Compared with the locale's own rendering of the plain number, so the test does not depend on the separator.
  const plain = (n: number) => n.toLocaleString("sq-AL", { maximumFractionDigits: 3 });
  assert.equal(fmtNum(23.876, 3), plain(23.876));
  assert.equal(fmtNum(23.87, 3), plain(23.87));
  assert.equal(fmtNum(23.8, 3), plain(23.8));
  assert.equal(fmtNum(23, 3), plain(23));
  assert.equal(fmtKg(23.8), `${plain(23.8)} kg`);
  assert.equal(fmtKg(406584.15, 0), `${plain(406584)} kg`);
  assert.equal(plain(23.8).length, 4);
});
