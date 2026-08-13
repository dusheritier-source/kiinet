import test from "node:test";
import assert from "node:assert/strict";
import { canOptimizeMedia } from "../../components/OptimizedMedia";

test("optimizes local and trusted media hosts", () => {
  assert.equal(canOptimizeMedia("/icon-192.png"), true);
  assert.equal(canOptimizeMedia("https://firebasestorage.googleapis.com/v0/b/demo/o/image.jpg"), true);
  assert.equal(canOptimizeMedia("https://project.supabase.co/storage/v1/object/public/media/a.jpg"), true);
});

test("does not proxy malformed or unknown user URLs", () => {
  assert.equal(canOptimizeMedia("not a URL"), false);
  assert.equal(canOptimizeMedia("https://unknown.example/avatar.jpg"), false);
});
