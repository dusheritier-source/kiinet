export const GOOGLE_STUN_SERVER: RTCIceServer = {
  urls: "stun:stun.l.google.com:19302",
};

// Additional relay servers can be supplied here in the future without changing
// the calling or signaling implementation.
export function buildRtcConfiguration(fallbackIceServers: RTCIceServer[] = []): RTCConfiguration {
  return {
    iceServers: [GOOGLE_STUN_SERVER, ...fallbackIceServers],
    iceCandidatePoolSize: 10,
  };
}

export const rtcConfiguration = buildRtcConfiguration();
