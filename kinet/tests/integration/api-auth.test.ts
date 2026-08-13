import assert from "node:assert/strict";
import test from "node:test";

import { POST as aiCoach } from "../../app/api/ai-coach/route";
import { POST as highlightAnalysis } from "../../app/api/highlight-analysis/route";
import { POST as mediaAssist } from "../../app/api/media-assist/route";
import { POST as pushNotification } from "../../app/api/notifications/push/route";
import { POST as emailDigest } from "../../app/api/notifications/digest/route";
import { POST as runJobs } from "../../app/api/jobs/run/route";

const endpoints = [
  ["AI coach", aiCoach],
  ["highlight analysis", highlightAnalysis],
  ["media assistant", mediaAssist],
  ["push notification", pushNotification],
  ["email digest", emailDigest],
] as const;

for (const [name, handler] of endpoints) {
  test(`${name} rejects requests without a Firebase bearer token`, async () => {
    const response = await handler(new Request(`http://localhost/api/${encodeURIComponent(name)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
  });
}

test("background job runner rejects requests without the cron secret", async () => {
  const response = await runJobs(new Request("http://localhost/api/jobs/run", { method: "POST" }));
  assert.equal(response.status, 401);
});
