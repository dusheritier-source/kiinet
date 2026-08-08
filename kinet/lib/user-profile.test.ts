import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

const { fileToDataUrl, resolveUserSearchCandidates, withCacheBuster } = require("./user-profile");

test("adds a cache-busting query string to fresh profile images", () => {
  const result = withCacheBuster("https://cdn.example.com/avatar.png", 42);
  assert.equal(result, "https://cdn.example.com/avatar.png?v=42");
});

test("converts a selected file into a data URL preview", async () => {
  const file = new File(["hello"], "avatar.png", { type: "image/png" });
  const result = await fileToDataUrl(file);
  assert.match(result, /^data:image\/png;base64,/);
});

test("falls back to a broader user fetch when prefix queries miss a partial name", async () => {
  let prefixCalls = 0;
  let fullCalls = 0;

  const result = await resolveUserSearchCandidates({
    normalized: "alex",
    fetchPrefixedUsers: async () => {
      prefixCalls += 1;
      return [];
    },
    fetchAllUsers: async () => {
      fullCalls += 1;
      return [{ id: "user-1" } as never];
    },
  });

  assert.equal(prefixCalls, 1);
  assert.equal(fullCalls, 1);
  assert.deepEqual(result, [{ id: "user-1" }]);
});
