"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Download, Monitor, Share, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPage() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean(navigatorWithStandalone.standalone));
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") setInstallPrompt(null);
  };

  return <main className="mx-auto flex min-h-[75svh] max-w-3xl items-center px-4 py-10">
    <Card className="w-full overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-cyan-500/15 via-sky-500/10 to-transparent text-center">
        <Image src="/icon-192.png" alt="Kinet app icon" width={96} height={96} priority className="mx-auto h-24 w-24 rounded-3xl shadow-xl" />
        <CardTitle className="mt-4 text-3xl">Install Kinet</CardTitle>
        <CardDescription>Get fast, full-screen access from your phone, tablet, or computer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-6 sm:p-8">
        {installed ? <div className="flex items-center justify-center gap-2 rounded-xl bg-green-500/10 p-4 text-green-500"><CheckCircle2 className="h-5 w-5" /><span className="font-medium">Kinet is installed on this device.</span></div> : installPrompt ? <Button size="lg" className="w-full" onClick={() => void install()}><Download className="mr-2 h-5 w-5" />Install Kinet</Button> : isIos ? <div className="rounded-xl border p-4"><p className="flex items-center gap-2 font-semibold"><Share className="h-5 w-5" />Install on iPhone or iPad</p><p className="mt-2 text-sm text-muted-foreground">Open this page in Safari, tap Share, then choose <strong>Add to Home Screen</strong>.</p></div> : <div className="rounded-xl border p-4"><p className="flex items-center gap-2 font-semibold"><Download className="h-5 w-5" />Install from your browser</p><p className="mt-2 text-sm text-muted-foreground">Open this page in Chrome or Edge, then use the browser menu and select <strong>Install Kinet</strong> or <strong>Add to Home screen</strong>.</p></div>}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4"><Smartphone className="h-6 w-6 text-primary" /><p className="mt-2 font-semibold">Phone and tablet</p><p className="mt-1 text-sm text-muted-foreground">Adds Kinet to your home screen and opens it like an app.</p></div>
          <div className="rounded-xl border p-4"><Monitor className="h-6 w-6 text-primary" /><p className="mt-2 font-semibold">Computer</p><p className="mt-1 text-sm text-muted-foreground">Installs Kinet in its own window from Chrome or Edge.</p></div>
        </div>

        <Button variant="outline" className="w-full" asChild><Link href="/">Continue on the website</Link></Button>
      </CardContent>
    </Card>
  </main>;
}
