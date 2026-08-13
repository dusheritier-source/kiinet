import assert from "node:assert/strict";
import test from "node:test";

import { editDistance, expandQuery, intelligentMatch, normalizeSearchText, parseSearchIntent, suggestCorrection } from "../../lib/search-intelligence";

test("normalizes accents, punctuation, and whitespace", () => {
  assert.equal(normalizeSearchText("  ÉlITE!!!   Hoops  "), "elite hoops");
});

test("expands known search synonyms without duplicates", () => {
  assert.deepEqual(expandQuery("photo"), ["photo", "photography", "picture", "image"]);
});

test("scores exact, partial, and typo-tolerant matches", () => {
  assert.ok(intelligentMatch("basketball highlights", "basketball").score > intelligentMatch("basketball highlights", "baskteball").score);
  assert.equal(intelligentMatch("football training", "recipe").matches, false);
  assert.equal(editDistance("coach", "couch"), 1);
});

test("parses content, recency, popularity, and creator intent", () => {
  assert.deepEqual(parseSearchIntent("latest viral videos from @alex"), {
    contentType: "videos", recent: true, popular: true, creator: "alex",
  });
});

test("suggests only close single-token corrections", () => {
  assert.equal(suggestCorrection("fotball", ["football", "basketball"]), "football");
  assert.equal(suggestCorrection("sports news", ["sport"]), null);
});
