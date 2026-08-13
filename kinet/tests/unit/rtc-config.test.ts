import assert from "node:assert/strict";
import test from "node:test";
import { buildRtcConfiguration } from "../../lib/rtc-config";

test("uses STUN-only configuration when TURN is absent", () => {
  assert.equal(buildRtcConfiguration({}).iceServers?.length, 2);
});

test("adds a credentialed TURN relay", () => {
  const config = buildRtcConfiguration({ turnUrl: "turns:relay.example.com:5349", username: "user", credential: "secret" });
  assert.equal(config.iceServers?.length, 3);
  assert.equal(config.iceCandidatePoolSize, 10);
});

test("rejects incomplete or invalid TURN configuration", () => {
  assert.throws(() => buildRtcConfiguration({ turnUrl: "https://relay.example.com", username: "user", credential: "secret" }));
  assert.throws(() => buildRtcConfiguration({ turnUrl: "turn:relay.example.com" }));
});
