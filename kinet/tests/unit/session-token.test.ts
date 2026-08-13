import assert from "node:assert/strict";
import test from "node:test";

import { createSessionMarker, verifySessionMarker } from "../../lib/session-token";

test("creates a signed session marker that validates", () => {
  process.env.KINET_SESSION_SECRET = "test-secret-with-more-than-thirty-two-characters";
  const marker = createSessionMarker("user-123");
  assert.equal(verifySessionMarker(marker.value), true);
  assert.equal(marker.maxAge, 3600);
});

test("rejects tampered and expired session markers", () => {
  process.env.KINET_SESSION_SECRET = "test-secret-with-more-than-thirty-two-characters";
  const marker = createSessionMarker("user-123");
  assert.equal(verifySessionMarker(marker.value.replace("user-123", "attacker")), false);
  assert.equal(verifySessionMarker("user-123.1.invalid"), false);
});
