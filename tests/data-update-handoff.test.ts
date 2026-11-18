import assert from "node:assert/strict";
import test from "node:test";
import { createDataUpdateHandoffTokens, DATA_UPDATE_HANDOFF_TTL_MS, dataUpdateHandoffExpired, hashDataUpdateHandoffToken, validDataUpdateHandoffToken } from "../lib/data-update-handoff";

test("creates independent opaque tokens for the phone and desktop", () => {
  const first = createDataUpdateHandoffTokens();
  const second = createDataUpdateHandoffTokens();
  assert.equal(validDataUpdateHandoffToken(first.scanToken), true);
  assert.equal(validDataUpdateHandoffToken(first.pollToken), true);
  assert.notEqual(first.scanToken, first.pollToken);
  assert.notEqual(first.scanToken, second.scanToken);
  assert.notEqual(hashDataUpdateHandoffToken(first.scanToken, "scan"), hashDataUpdateHandoffToken(first.scanToken, "poll"));
  assert.equal(hashDataUpdateHandoffToken(first.scanToken, "scan").includes(first.scanToken), false);
});

test("rejects malformed handoff tokens and expires sessions after ten minutes", () => {
  for (const value of [null, "", "short", "a".repeat(42), "a".repeat(44), `${"a".repeat(42)}!`]) assert.equal(validDataUpdateHandoffToken(value), false);
  assert.equal(DATA_UPDATE_HANDOFF_TTL_MS, 600000);
  const now = new Date("2026-11-17T15:00:00.000Z");
  assert.equal(dataUpdateHandoffExpired(new Date("2026-11-17T15:09:59.000Z"), now), false);
  assert.equal(dataUpdateHandoffExpired(new Date("2026-11-17T15:00:00.000Z"), now), true);
  assert.equal(dataUpdateHandoffExpired(new Date("2026-11-17T14:59:59.000Z"), now), true);
});
