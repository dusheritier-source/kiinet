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

      {/* Main Content - Full Page Auth */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Welcome Section */}
          <div className="mb-8 text-center">
            <h1 className="mb-3 text-4xl font-bold">Welcome to Kinet</h1>
            <p className="text-lg text-muted-foreground">
              The sports network for athletes, coaches, scouts, and creators
            </p>
          </div>

          {/* Auth Cards */}
          <div className="space-y-4">
            {/* Login Card */}
            <Link href="/login" className="block rounded-2xl border-2 border-primary bg-primary/5 p-6 transition-all hover:bg-primary/10 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-primary">Log In</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Already have an account?</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                  <svg className="h-6 w-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Sign Up Card */}
            <Link href="/signup" className="block rounded-2xl border-2 border-primary bg-primary p-6 transition-all hover:bg-primary/90 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-primary-foreground">Sign Up</h2>
                  <p className="mt-1 text-sm text-primary-foreground/90">Create a new account</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-foreground">
                  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>

          {/* Waitlist Section */}
          <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-center text-lg font-semibold">Join the Waitlist</h2>
            <p className="mb-4 text-center text-sm text-muted-foreground">
              Get early access and updates
            </p>
            <form className="space-y-3" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const name = formData.get('name') as string;
              const email = formData.get('email') as string;
              const role = formData.get('role') as string;
              
              await fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, role })
              });
              
              alert('You are on the list! We will notify you when early access is available.');
              e.currentTarget.reset();
            }}>
              <input
                name="name"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                placeholder="Your name"
                required
              />
              <input
                name="email"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                placeholder="Email"
                type="email"
                required
              />
              <select
                name="role"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="athlete">Athlete</option>
                <option value="coach">Coach</option>
                <option value="scout">Scout</option>
                <option value="fan">Fan</option>
                <option value="creator">Creator</option>
              </select>
              <button
                className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                type="submit"
              >
                Join Waitlist
              </button>
            </form>
          </div>

          {/* Invite-only Notice */}
          {settings?.requireInvite && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
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