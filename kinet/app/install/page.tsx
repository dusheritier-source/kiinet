"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, CheckCircle2, Clapperboard, Download, MessageCircle, Monitor, Search, Share, ShieldCheck, Smartphone, Sparkles, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInstallPrompt, saveInstallPrompt, type KinetInstallPrompt } from "@/lib/pwa-install";

export default function InstallPage() {
  const [installPrompt, setInstallPrompt] = useState<KinetInstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean(navigatorWithStandalone.standalone));
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstallPrompt(getInstallPrompt());

    const capturePrompt = (event: Event) => setInstallPrompt((event as CustomEvent<KinetInstallPrompt | null>).detail);
    const handleInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("kinet:install-prompt", capturePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("kinet:install-prompt", capturePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) { setShowInstructions(true); return; }
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      saveInstallPrompt(null);
      setInstallPrompt(null);
      if (result.outcome !== "accepted") setShowInstructions(true);
    } catch {
      saveInstallPrompt(null);
      setInstallPrompt(null);
      setShowInstructions(true);
    } finally {
      setInstalling(false);
    }
  };

  return <main className="mx-auto flex min-h-[75svh] max-w-3xl items-center px-4 py-10">
    <Card className="w-full overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-cyan-500/15 via-sky-500/10 to-transparent text-center">
        <Image src="/icon-192.png" alt="Kinet app icon" width={96} height={96} priority className="mx-auto h-24 w-24 rounded-3xl shadow-xl" />
        <CardTitle className="mt-4 text-3xl">Install Kinet</CardTitle>
        <CardDescription className="mx-auto max-w-xl text-base">Share your story, discover inspiring people, and stay close to the communities that matter to you—all in one social app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-6 sm:p-8">
        {installed ? <div className="flex items-center justify-center gap-2 rounded-xl bg-green-500/10 p-4 text-green-500"><CheckCircle2 className="h-5 w-5" /><span className="font-medium">Kinet is installed on this device.</span></div> : <><Button size="lg" className="w-full text-base" disabled={installing} onClick={() => void install()}><Download className="mr-2 h-5 w-5" />{installing ? "Opening installer…" : "Install Kinet now"}</Button><p className="text-center text-xs text-muted-foreground">Free installation. No app-store account is required.</p></>}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4"><Smartphone className="h-6 w-6 text-primary" /><p className="mt-2 font-semibold">Phone and tablet</p><p className="mt-1 text-sm text-muted-foreground">Adds Kinet to your home screen and opens it like an app.</p></div>
          <div className="rounded-xl border p-4"><Monitor className="h-6 w-6 text-primary" /><p className="mt-2 font-semibold">Computer</p><p className="mt-1 text-sm text-muted-foreground">Installs Kinet in its own window from Chrome or Edge.</p></div>
        </div>

        <section className="space-y-3 border-t pt-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Made for connection</p>
            <h2 className="mt-2 text-2xl font-bold">Everything you enjoy, one tap away</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Kinet brings conversations, creative media, discovery, and community tools together in a fast experience designed for everyday use.</p>
          </div>
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            {[
              { icon: Clapperboard, title: "Share your moments", text: "Publish photos, multi-photo posts, videos, reels, stories, and ideas." },
              { icon: MessageCircle, title: "Chat and connect", text: "Keep conversations going through direct messages and community interactions." },
              { icon: Search, title: "Discover more", text: "Find creators, people, topics, and content that match your interests." },
              { icon: Users, title: "Build community", text: "Follow people, join conversations, and grow meaningful connections." },
              { icon: Sparkles, title: "Create with confidence", text: "Use helpful creative tools for captions, media, and content ideas." },
              { icon: Bell, title: "Stay up to date", text: "Receive timely alerts for the activity and conversations you care about." },
            ].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-3 rounded-xl bg-muted/45 p-4"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">{text}</p></div></div>)}
          </div>
        </section>

        <div className="flex gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
          <div><p className="font-semibold">Safe, convenient access</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Installing Kinet creates a trusted shortcut from this website. Updates arrive automatically, and you can remove the app from your device whenever you want.</p></div>
        </div>

        <Button variant="outline" className="w-full" asChild><Link href="/">Continue on the website</Link></Button>
      </CardContent>
    </Card>
    {showInstructions ? <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="install-help-title" onClick={() => setShowInstructions(false)}><div className="w-full max-w-md rounded-t-3xl border bg-background p-6 shadow-2xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><h2 id="install-help-title" className="text-xl font-bold">Install Kinet</h2><p className="mt-1 text-sm text-muted-foreground">Follow these steps on this device.</p></div><Button type="button" size="icon" variant="ghost" aria-label="Close installation instructions" onClick={() => setShowInstructions(false)}><X className="h-5 w-5" /></Button></div>{isIos ? <ol className="mt-5 space-y-4 text-sm"><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">1</span><span>Open this page in <strong>Safari</strong>.</span></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">2</span><span>Tap the <strong>Share</strong> button <Share className="ml-1 inline h-4 w-4" /> at the bottom of Safari.</span></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">3</span><span>Scroll and tap <strong>Add to Home Screen</strong>.</span></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">4</span><span>Tap <strong>Add</strong>. Kinet will appear with your other apps.</span></li></ol> : <ol className="mt-5 space-y-4 text-sm"><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">1</span><span>Open this page in <strong>Chrome</strong> or <strong>Microsoft Edge</strong>.</span></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">2</span><span>Open the browser menu <strong>⋮</strong>.</span></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">3</span><span>Choose <strong>Install app</strong>, <strong>Install Kinet</strong>, or <strong>Add to Home screen</strong>.</span></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">4</span><span>Confirm <strong>Install</strong>.</span></li></ol>}<Button type="button" className="mt-6 w-full" onClick={() => setShowInstructions(false)}>I understand</Button></div></div> : null}
  </main>;
}
