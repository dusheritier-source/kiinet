"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const timeout = useRef<number>();

  useEffect(() => {
    setNavigating(false);
    window.clearTimeout(timeout.current);
  }, [pathname, searchParams]);

  useEffect(() => {
    const start = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      setNavigating(true);
      window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(() => setNavigating(false), 8000);
    };
    document.addEventListener("click", start, true);
    return () => {
      document.removeEventListener("click", start, true);
      window.clearTimeout(timeout.current);
    };
  }, []);

  return navigating ? <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/20" role="progressbar" aria-label="Opening page"><div className="h-full w-1/2 animate-[navigation-progress_900ms_ease-in-out_infinite] bg-primary shadow-[0_0_12px_hsl(var(--primary))]" /></div> : null;
}
