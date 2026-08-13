import assert from "node:assert/strict";
import test from "node:test";

import { getSiteUrl } from "../../lib/site-url";

test("normalizes configured site URLs", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://kinet.example/";
  assert.equal(getSiteUrl(), "https://kinet.example");
  process.env.NEXT_PUBLIC_SITE_URL = previous;
});

test("adds HTTPS to platform hostnames", () => {
  const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
  const previousVercel = process.env.VERCEL_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_URL = "preview.kinet.example";
  assert.equal(getSiteUrl(), "https://preview.kinet.example");
  process.env.NEXT_PUBLIC_SITE_URL = previousSite;
  process.env.VERCEL_URL = previousVercel;
});
