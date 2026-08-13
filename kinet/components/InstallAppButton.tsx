"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setInstalled(standalone || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const complete = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  if (!prompt || installed) return null;
  return <Button type="button" variant="outline" size={compact ? "icon" : "sm"} aria-label="Install Kinet app" title="Install Kinet app" onClick={async () => { await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === "accepted") setPrompt(null); }}><Download className={compact ? "h-5 w-5" : "mr-2 h-4 w-4"} />{compact ? null : "Install app"}</Button>;
}
