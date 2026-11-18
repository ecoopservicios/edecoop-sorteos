import assert from "node:assert/strict";
import test from "node:test";
import { dataUpdatePhoneDigits, formatDataUpdatePhone } from "../lib/data-update-phone";

test("formats a phone progressively while keeping only ten stored digits", () => {
  assert.equal(formatDataUpdatePhone(""), "");
  assert.equal(formatDataUpdatePhone("809"), "(809");
  assert.equal(formatDataUpdatePhone("8093"), "(809) 3");
  assert.equal(formatDataUpdatePhone("809354"), "(809) 354");
  assert.equal(formatDataUpdatePhone("8093542"), "(809) 354 - 2");
  assert.equal(formatDataUpdatePhone("8093542752"), "(809) 354 - 2752");
  assert.equal(dataUpdatePhoneDigits("(809) 354 - 2752"), "8093542752");
  assert.equal(dataUpdatePhoneDigits("809354275299"), "8093542752");
});
