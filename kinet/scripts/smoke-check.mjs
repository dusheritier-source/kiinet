import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

for (const route of ["app/page.tsx", "app/login/page.tsx", "app/signup/page.tsx", "app/feed/page.tsx", "app/messages/page.tsx", "app/settings/page.tsx", "app/api/health/route.ts", "app/api/jobs/run/route.ts"]) {
  assert.ok(existsSync(new URL(`../${route}`, import.meta.url)), `Missing core route: ${route}`);
}
assert.equal(existsSync(new URL("../app/test-env/page.tsx", import.meta.url)), false);
assert.equal(existsSync(new URL("../app/test-realtime/page.tsx", import.meta.url)), false);
const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
for (const route of ["/feed", "/messages", "/settings", "/admin"]) assert.ok(middleware.includes(`"${route}"`), `${route} is not protected`);
console.log("Application smoke checks passed.");
