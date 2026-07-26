"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuthContext } from "@/components/AuthProvider";
import { getAppAccessSettings, type AppAccessSettings } from "@/lib/admin";

export default function Home() {
  const { user, loading } = useAuthContext();
  const router = useRouter();
  const [settings, setSettings] = useState<AppAccessSettings | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/feed");
      return;
    }

    void getAppAccessSettings().then(setSettings);
  }, [loading, router, user]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent">
            Log In
          </Link>
          
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-lg font-bold text-primary-foreground">K</span>
            </div>
            <span className="text-xl font-bold">Kinet</span>
          </div>
          
          <Link href="/signup" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            Sign Up
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          {/* Welcome Message */}
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold">Welcome to Kinet</h1>
            <p className="text-muted-foreground">
              The sports network for athletes, coaches, scouts, and creators
            </p>
          </div>

          {/* Invite-only Notice */}
          {settings?.requireInvite && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
              <p className="text-sm font-medium text-primary">Invite-only access is active</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {settings.inviteOnlyMessage}
              </p>
            </div>
          )}

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            © 2026 Kinet. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}