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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-lg font-bold text-primary-foreground">K</span>
            </div>
            <span className="text-xl font-bold">Kinet</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 transition-colors hover:bg-accent">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
            <button className="rounded-lg p-2 transition-colors hover:bg-accent">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Feed Style */}
      <main className="flex-1 pb-16">
        <div className="mx-auto max-w-lg">
          {/* Stories / Highlights Bar */}
          <div className="border-b bg-background">
            <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-hide">
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-2 border-dashed border-primary p-0.5">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10">
                      <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Your Story</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="h-16 w-16 rounded-full border-2 border-primary p-0.5">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                    <span className="text-lg font-bold text-primary">🏀</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Basketball</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="h-16 w-16 rounded-full border-2 border-primary p-0.5">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                    <span className="text-lg font-bold text-primary">⚽</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Soccer</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="h-16 w-16 rounded-full border-2 border-primary p-0.5">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                    <span className="text-lg font-bold text-primary">🏈</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Football</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="h-16 w-16 rounded-full border-2 border-primary p-0.5">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                    <span className="text-lg font-bold text-primary">🏆</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Training</span>
              </div>
            </div>
          </div>

          {/* Posts Feed */}
          <div className="space-y-0">
            {/* Post 1 */}
            <div className="border-b">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <span className="text-lg">🏀</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">basketball_king</p>
                  <p className="text-xs text-muted-foreground">Los Angeles, CA</p>
                </div>
                <button className="rounded-lg p-1 hover:bg-accent">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                </button>
              </div>
              
              <div className="flex aspect-square items-center justify-center bg-muted/20">
                <div className="text-center">
                  <svg className="mx-auto h-16 w-16 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-2 text-sm text-muted-foreground">Video Highlight</p>
                </div>
              </div>

              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button className="rounded-lg p-1 transition-colors hover:bg-accent">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                    <button className="rounded-lg p-1 transition-colors hover:bg-accent">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </button>
                    <button className="rounded-lg p-1 transition-colors hover:bg-accent">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                  <button className="rounded-lg p-1 transition-colors hover:bg-accent">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                </div>
                <p className="mt-2 text-sm"><span className="font-semibold">basketball_king</span> Game winning shot! 🏀🔥</p>
                <p className="mt-1 text-xs text-muted-foreground">View all 12 comments</p>
              </div>
            </div>

            {/* Post 2 */}
            <div className="border-b">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <span className="text-lg">⚽</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">soccer_star_99</p>
                  <p className="text-xs text-muted-foreground">Barcelona, Spain</p>
                </div>
                <button className="rounded-lg p-1 hover:bg-accent">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                </button>
              </div>
              
              <div className="flex aspect-square items-center justify-center bg-muted/20">
                <div className="text-center">
                  <svg className="mx-auto h-16 w-16 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-2 text-sm text-muted-foreground">Training Session</p>
                </div>
              </div>

              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button className="rounded-lg p-1 transition-colors hover:bg-accent">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                    <button className="rounded-lg p-1 transition-colors hover:bg-accent">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </button>
                    <button className="rounded-lg p-1 transition-colors hover:bg-accent">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                  <button className="rounded-lg p-1 transition-colors hover:bg-accent">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                </div>
                <p className="mt-2 text-sm"><span className="font-semibold">soccer_star_99</span> Morning training session ⚽💪</p>
                <p className="mt-1 text-xs text-muted-foreground">View all 8 comments</p>
              </div>
            </div>

            {/* Post 3 */}
            <div className="border-b">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <span className="text-lg">🏈</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">touchdown_king</p>
                  <p className="text-xs text-muted-foreground">Dallas, TX</p>
                </div>
                <button className="rounded-lg p-1 hover:bg-accent">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                </button>
              </div>
              
              <div className="flex aspect-square items-center justify-center bg-muted/20">
                <div className="text-center">
                  <svg className="mx-auto h-16 w-16 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-2 text-sm text-muted-foreground">Game Highlights</p>
                </div>
              </div>

              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button className="rounded-lg p-1 transition-colors hover:bg-accent">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                    <button className="rounded-lg p-1 transition-colors hover:bg-accent">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </button>
                    <button className="rounded-lg p-1 transition-colors hover:bg-accent">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                  <button className="rounded-lg p-1 transition-colors hover:bg-accent">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                </div>
                <p className="mt-2 text-sm"><span className="font-semibold">touchdown_king</span> Touchdown! 🏈🎉</p>
                <p className="mt-1 text-xs text-muted-foreground">View all 24 comments</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation Bar - App Style */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-around px-4">
          <button className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-primary">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-[10px]">Home</span>
          </button>

          <button className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-[10px]">Search</span>
          </button>

          <button className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg border-2 border-current">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-[10px]">Create</span>
          </button>

          <button className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-[10px]">Messages</span>
          </button>

          <button className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <span className="text-xs">👤</span>
            </div>
            <span className="text-[10px]">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}