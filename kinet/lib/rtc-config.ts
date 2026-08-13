export function buildRtcConfiguration(input: { turnUrl?: string; username?: string; credential?: string }): RTCConfiguration {
  const turnUrl = input.turnUrl?.trim() || "";
  if (turnUrl && !/^turns?:[^\s]+$/i.test(turnUrl)) throw new Error("TURN URL must start with turn: or turns:.");
  if (turnUrl && (!input.username?.trim() || !input.credential?.trim())) throw new Error("TURN username and credential are required when TURN is enabled.");
  return { iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    ...(turnUrl ? [{ urls: turnUrl, username: input.username!.trim(), credential: input.credential!.trim() }] : []),
  ], iceCandidatePoolSize: 10 };
}
