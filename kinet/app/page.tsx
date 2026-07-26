"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuthContext } from "@/components/AuthProvider";
import { getAppAccessSettings, type AppAccessSettings } from "@/lib/admin";
import { createWaitlistEntry } from "@/lib/business";

export default function Home() {
  const { user, loading } = useAuthContext();
  const router = useRouter();
  const [settings, setSettings] = useState<AppAccessSettings | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "athlete", note: "" });
  const [saved, setSaved] = useState(false);
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

  const handleWaitlist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createWaitlistEntry(form);
    setSaved(true);
    setForm({ name: "", email: "", role: "athlete", note: "" });
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      {/* App Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-lg font-bold text-primary-foreground">K</span>
            </div>
            <span className="text-xl font-bold">Kinet</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign Up
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          {/* Hero Section */}
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm">
              <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-primary"></span>
              <span className="font-medium text-primary">Now in Public Beta</span>
            </div>
            
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              The Sports Network for{" "}
              <span className="gradient-text">Athletes & Creators</span>
            </h1>
            
            <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Share highlights, book sessions, grow your audience, and build your path in the sports world.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="w-full rounded-xl bg-primary px-8 py-3.5 text-center font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg sm:w-auto"
              >
                Get Started
              </Link>
              <Link
                href="/about"
                className="w-full rounded-xl border border-border bg-background px-8 py-3.5 text-center font-semibold transition-all hover:bg-accent sm:w-auto"
              >
                Learn More
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Share Highlights</h3>
              <p className="text-sm text-muted-foreground">Upload and showcase your best moments to build your sports portfolio.</p>
            </div>

            <div className="rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Book Sessions</h3>
              <p className="text-sm text-muted-foreground">Connect with coaches and athletes for training sessions and mentorship.</p>
            </div>

            <div className="rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Grow Audience</h3>
              <p className="text-sm text-muted-foreground">Build your following and connect with scouts, teams, and fans worldwide.</p>
            </div>
          </div>

          {/* Waitlist Section */}
          <div className="mt-16 rounded-3xl border bg-card p-6 shadow-lg sm:p-8 lg:p-10">
            <div className="mx-auto max-w-2xl">
              <div className="text-center">
                <h2 className="text-3xl font-bold">Join the Waitlist</h2>
                <p className="mt-3 text-muted-foreground">
                  Get early access and be the first to know when we launch new features.
                </p>
              </div>

              <form className="mt-8 space-y-4" onSubmit={handleWaitlist}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
                      Your Name
                    </label>
                    <input
                      id="name"
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="John Doe"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                      Email
                    </label>
                    <input
                      id="email"
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="you@example.com"
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="role" className="mb-1.5 block text-sm font-medium">
                    I am a...
                  </label>
                  <select
                    id="role"
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.role}
                    onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                  >
                    <option value="athlete">Athlete</option>
                    <option value="coach">Coach</option>
                    <option value="scout">Scout</option>
                    <option value="fan">Fan</option>
                    <option value="creator">Creator</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="note" className="mb-1.5 block text-sm font-medium">
                    What do you want from Kinet?
                  </label>
                  <textarea
                    id="note"
                    className="min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Tell us about your goals and what you're looking for..."
                    value={form.note}
                    onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  />
                </div>

                <button
                  className="w-full rounded-xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg"
                  type="submit"
                >
                  Join Waitlist
                </button>

                {saved && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
                    <p className="text-sm font-medium text-primary">You're on the list! 🎉</p>
                    <p className="mt-1 text-xs text-muted-foreground">We'll notify you when early access is available.</p>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Invite-only Notice */}
          {settings?.requireInvite && (
            <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
              <p className="font-semibold text-primary">Invite-only onboarding is active</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {settings.inviteOnlyMessage}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* App-like Footer */}
      <footer className="border-t bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-primary-foreground">K</span>
              </div>
              <span className="text-lg font-bold">Kinet</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Kinet. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}