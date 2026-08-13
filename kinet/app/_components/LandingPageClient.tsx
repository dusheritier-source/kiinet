"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAppAccessSettings, type AppAccessSettings } from "@/lib/admin";

export default function LandingPageClient() {
  const router = useRouter();
  const { user, loading } = useAuthContext();
  const [settings, setSettings] = useState<AppAccessSettings | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (loading) return;
    if (user) {
      router.replace("/feed");
      return;
    }
    void getAppAccessSettings().then(setSettings);
  }, [loading, router, user]);

  if (!mounted || loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a1628]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a1628]">
      {/* Hero Section */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-8 flex items-center justify-center gap-3">
              <Image src="/icon-192.png" alt="Kinet logo" width={80} height={80} priority className="h-20 w-20 rounded-[22px] object-cover shadow-lg shadow-black/40" />
              <span className="text-6xl font-bold text-white">Kinet</span>
            </div>

            <h1 className="mb-4 text-5xl font-bold text-white sm:text-6xl">
              Connect in Real-Time
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-xl text-gray-300">
              The next-generation social platform where creators, communities, and
              conversations come alive. Share moments, discover trends, and build
              meaningful connections.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-cyan-400 to-blue-600 text-lg font-semibold hover:shadow-lg hover:shadow-cyan-500/50 sm:w-auto"
                >
                  Get Started
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-2 border-cyan-400 text-lg font-semibold text-cyan-400 hover:bg-cyan-400/10 sm:w-auto"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <h2 className="sr-only">Platform features</h2>
          <div className="mt-24 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/20">
                  <svg
                    className="h-6 w-6 text-cyan-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-semibold text-white">
                  Real-Time Updates
                </h3>
                <p className="text-gray-300">
                  Experience instant notifications, live comments, and real-time
                  messaging with WebSocket technology.
                </p>
              </CardContent>
            </Card>

            <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/20">
                  <svg
                    className="h-6 w-6 text-cyan-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-semibold text-white">
                  Rich Media Sharing
                </h3>
                <p className="text-gray-300">
                  Share photos, videos, reels, and stories with advanced editing
                  tools and AI-powered enhancements.
                </p>
              </CardContent>
            </Card>

            <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/20">
                  <svg
                    className="h-6 w-6 text-cyan-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-semibold text-white">
                  Community Building
                </h3>
                <p className="text-gray-300">
                  Follow creators, join communities, and engage with like-minded
                  individuals across the globe.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Trending Preview Section */}
          <div className="mt-24">
            <h2 className="mb-8 text-center text-3xl font-bold text-white">
              Trending Now
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  tag: "#TechInnovation",
                  posts: "12.5K",
                  category: "Technology",
                },
                {
                  tag: "#CreativeArts",
                  posts: "8.3K",
                  category: "Art & Design",
                },
                {
                  tag: "#FitnessMotivation",
                  posts: "15.2K",
                  category: "Health & Wellness",
                },
              ].map((trend) => (
                <Card
                  key={trend.tag}
                  className="border-cyan-500/20 bg-white/5 backdrop-blur-sm transition-all hover:scale-105 hover:border-cyan-400/40"
                >
                  <CardContent className="p-6">
                    <p className="text-sm text-cyan-400">{trend.category}</p>
                    <h3 className="mt-2 text-xl font-bold text-white">
                      {trend.tag}
                    </h3>
                    <p className="mt-1 text-sm text-gray-400">
                      {trend.posts} posts
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-24 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-12 text-center backdrop-blur-sm">
            <h2 className="mb-4 text-3xl font-bold text-white">
              Ready to Join the Community?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-300">
              Create your free account today and start connecting with millions
              of users worldwide.
            </p>
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-gradient-to-r from-cyan-400 to-blue-600 text-lg font-semibold hover:shadow-lg hover:shadow-cyan-500/50"
              >
                Create Your Account
              </Button>
            </Link>
          </div>

          {/* Footer */}
          <footer className="mt-24 border-t border-cyan-500/10 pt-8 text-center">
            <p className="text-sm text-gray-400">
              © 2026 Kinet Technologies. All rights reserved.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
