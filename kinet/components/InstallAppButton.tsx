"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getInstallPrompt, saveInstallPrompt, type KinetInstallPrompt } from "@/lib/pwa-install";

export default function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const [prompt, setPrompt] = useState<KinetInstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setInstalled(standalone || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setPrompt(getInstallPrompt());
    const capture = (event: Event) => setPrompt((event as CustomEvent<KinetInstallPrompt | null>).detail);
    const complete = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("kinet:install-prompt", capture);
    window.addEventListener("appinstalled", complete);
    return () => {
      window.removeEventListener("kinet:install-prompt", capture);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  if (!prompt || installed) return null;
  return <Button type="button" variant="outline" size={compact ? "icon" : "sm"} aria-label="Install Kinet app" title="Install Kinet app" onClick={async () => { await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === "accepted") { saveInstallPrompt(null); setPrompt(null); } }}><Download className={compact ? "h-5 w-5" : "mr-2 h-4 w-4"} />{compact ? null : "Install app"}</Button>;
}
