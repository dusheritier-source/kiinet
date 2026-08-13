import test from "node:test";
import assert from "node:assert/strict";
import { requestId } from "../../lib/observability";

test("preserves an incoming request ID", () => {
  assert.equal(requestId(new Request("https://kinet.test", { headers: { "x-request-id": "trace-123" } })), "trace-123");
});

test("generates a request ID when none is supplied", () => {
  assert.match(requestId(new Request("https://kinet.test")), /^[0-9a-f-]{36}$/i);
});
