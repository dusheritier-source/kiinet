import test from "node:test";
import assert from "node:assert/strict";

import { hasUsableAvatarSrc } from "./avatar";

test("treats missing and invalid avatar URLs as unusable", () => {
  assert.equal(hasUsableAvatarSrc(undefined), false);
  assert.equal(hasUsableAvatarSrc(null), false);
  assert.equal(hasUsableAvatarSrc(""), false);
  assert.equal(hasUsableAvatarSrc("   "), false);
  assert.equal(hasUsableAvatarSrc("null"), false);
  assert.equal(hasUsableAvatarSrc("undefined"), false);
  assert.equal(hasUsableAvatarSrc("https://cdn.example.com/avatar.png"), true);
  assert.equal(hasUsableAvatarSrc("/images/default-avatar.png"), true);
  assert.equal(hasUsableAvatarSrc("data:image/png;base64,abc"), true);
  assert.equal(hasUsableAvatarSrc("blob:https://example.com/123"), true);
});
