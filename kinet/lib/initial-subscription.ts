// Race a direct read against realtime startup, without letting a late read
// replace newer live data or publish after the subscriber has left.
export function subscribeWithInitialFetch<T>(
  subscribe: (publish: (value: T) => void) => () => void,
  load: () => Promise<T>,
  publish: (value: T) => void,
): () => void {
  let active = true;
  let receivedLive = false;
  const unsubscribe = subscribe((value) => {
    if (!active) return;
    receivedLive = true;
    publish(value);
  });
  if (!receivedLive) {
    void load().then((value) => {
      if (active && !receivedLive) publish(value);
    }).catch(() => undefined); // The realtime listener owns error reporting.
  }
  return () => { active = false; unsubscribe(); };
}
