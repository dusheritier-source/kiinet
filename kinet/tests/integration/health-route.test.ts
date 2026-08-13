import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../../app/api/health/route";

test("health route fails safely when the Admin credential is absent", async () => {
  const original = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  try {
    const response = await GET();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "unhealthy", checks: { configuration: { firebaseAdmin: false }, firestore: false } });
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    if (original === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    else process.env.FIREBASE_SERVICE_ACCOUNT_KEY = original;
  }
});

test("health route does not expose malformed credential contents", async () => {
  const original = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = "sensitive-invalid-json";
  try {
    const response = await GET();
    const text = await response.text();
    assert.equal(response.status, 503);
    for (const forbidden of ["sensitive-invalid-json", "private_key", "client_email", "stack"]) assert.equal(text.includes(forbidden), false);
  } finally {
    if (original === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    else process.env.FIREBASE_SERVICE_ACCOUNT_KEY = original;
  }
});
