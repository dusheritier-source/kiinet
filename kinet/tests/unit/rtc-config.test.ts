import assert from "node:assert/strict";
import test from "node:test";
import { buildRtcConfiguration, rtcConfiguration } from "../../lib/rtc-config";

test("uses Google's public STUN server for calls", () => {
  assert.deepEqual(rtcConfiguration.iceServers, [{ urls: "stun:stun.l.google.com:19302" }]);
  assert.equal(rtcConfiguration.iceCandidatePoolSize, 10);
});

test("allows a future relay fallback without changing call code", () => {
  const relay = { urls: "turns:relay.example.com:5349", username: "user", credential: "secret" };
  assert.deepEqual(buildRtcConfiguration([relay]).iceServers, [
    { urls: "stun:stun.l.google.com:19302" },
    relay,
  ]);
});
