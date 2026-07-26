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
      {/* Main Content - Auth Only */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Logo and Welcome */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary">
              <span className="text-4xl font-bold text-primary-foreground">K</span>
            </div>
            <h1 className="mb-2 text-3xl font-bold">Welcome to Kinet</h1>
            <p className="text-muted-foreground">
              The sports network for athletes, coaches, scouts, and creators
            </p>
          </div>

          {/* Auth Buttons */}
          <div className="space-y-3">
            <Link
              href="/login"
              className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="flex w-full items-center justify-center rounded-xl border border-border bg-background px-4 py-3.5 font-semibold transition-all hover:bg-accent"
            >
              Sign Up
            </Link>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Waitlist Section */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
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
            © 2024 Kinet. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}