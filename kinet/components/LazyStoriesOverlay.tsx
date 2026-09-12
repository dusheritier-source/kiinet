"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const StoriesOverlay = dynamic(() => import("@/components/StoriesOverlay"), {
  ssr: false,
});

export default function LazyStoriesOverlay() {
  const [mounted, setMounted] = useState(false);
  const [initialStoryId, setInitialStoryId] = useState<string>();

  useEffect(() => {
    const openStories = (event: Event) => {
      const storyId = (event as CustomEvent<{ storyId?: string }>).detail?.storyId;
      if (storyId) setInitialStoryId(storyId);
      setMounted(true);
    };
    window.addEventListener("open-stories", openStories);

    const requestIdle = window.requestIdleCallback;
    const idleId = typeof requestIdle === "function"
      ? requestIdle(() => setMounted(true), { timeout: 5000 })
      : undefined;
    const timer = typeof requestIdle === "function"
      ? undefined
      : window.setTimeout(() => setMounted(true), 3000);

    return () => {
      window.removeEventListener("open-stories", openStories);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return mounted ? <StoriesOverlay initialStoryId={initialStoryId} /> : null;
}
