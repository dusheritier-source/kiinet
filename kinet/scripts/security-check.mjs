import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
const pushRoute = readFileSync(new URL("../app/api/notifications/push/route.ts", import.meta.url), "utf8");
const digestRoute = readFileSync(new URL("../app/api/notifications/digest/route.ts", import.meta.url), "utf8");

assert.doesNotMatch(rules, /match \/users\/\{userId\}[\s\S]{0,300}allow update: if isSignedIn\(\);/);
assert.match(rules, /match \/staffPermissionMatrix\/\{docId\}[\s\S]{0,120}allow read, write: if isAdmin\(\);/);
assert.match(rules, /match \/appSettings\/\{docId\}[\s\S]{0,150}allow write: if isAdmin\(\);/);
assert.match(rules, /match \/reports\/\{reportId\}[\s\S]{0,300}allow update: if isAdmin\(\);/);
assert.doesNotMatch(rules, /match \/events\/\{eventId\}[\s\S]{0,180}allow (?:create|update|delete): if isSignedIn\(\);/);
assert.match(middleware, /kinet_session/);
assert.match(middleware, /test-env/);
assert.match(pushRoute, /requireApiUser/);
assert.match(digestRoute, /requireApiUser/);

console.log("Phase 1 security regression checks passed.");
