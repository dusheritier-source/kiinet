import test from "node:test";
import assert from "node:assert/strict";

import { getCurrentUserSettings } from "../../lib/settings";

test("notifications are enabled by default for new users", async () => {
  const settings = await getCurrentUserSettings();
  assert.equal(settings.pushNotificationsEnabled, true);
  assert.equal(settings.notificationChannels.push, true);
});
