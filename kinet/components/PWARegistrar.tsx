"use client";

import { useEffect } from "react";
import { saveInstallPrompt, type KinetInstallPrompt } from "@/lib/pwa-install";

export default function PWARegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker
      // One worker owns the root scope so offline caching and Firebase push do
      // not replace each other on installed mobile apps.
      .register("/firebase-messaging-sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => undefined);
    const captureInstall = (event: Event) => {
      event.preventDefault();
      saveInstallPrompt(event as KinetInstallPrompt);
    };
    const clearInstall = () => saveInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", captureInstall);
    window.addEventListener("appinstalled", clearInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstall);
      window.removeEventListener("appinstalled", clearInstall);
    };
  }, []);

  return null;
}
