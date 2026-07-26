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
    <div className="flex min-h-screen flex-col bg-[#0a1628]">
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mb-6 flex items-center justify-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600">
                <span className="text-4xl font-bold text-white">K</span>
              </div>
              <span className="text-5xl font-bold text-white">Kinet</span>
            </div>
            
            <h1 className="mb-3 text-4xl font-bold text-white">Welcome to Kinet</h1>
            <p className="text-lg text-gray-400">
              The sports social network for athletes, coaches, scouts, and creators.
            </p>
          </div>

          {/* Profile Cards */}
          <div className="mb-8 space-y-3">
            {/* Profile 1 */}
            <Link href="/login" className="flex items-center gap-4 rounded-2xl border border-gray-700 bg-[#1a2744] p-4 transition-all hover:bg-[#243456] hover:border-gray-600">
              <div className="h-16 w-16 overflow-hidden rounded-full bg-gradient-to-br from-yellow-400 to-orange-500">
                <div className="flex h-full w-full items-center justify-center text-2xl">👤</div>
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold text-white">ganza.so</p>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
                  <p className="text-sm text-gray-400">New notifications</p>
                </div>
              </div>
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {/* Profile 2 */}
            <Link href="/login" className="flex items-center gap-4 rounded-2xl border border-gray-700 bg-[#1a2744] p-4 transition-all hover:bg-[#243456] hover:border-gray-600">
              <div className="h-16 w-16 overflow-hidden rounded-full bg-gradient-to-br from-yellow-400 to-orange-500">
                <div className="flex h-full w-full items-center justify-center text-2xl">🏠</div>
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold text-white">1funnymemes00</p>
              </div>
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Create New Account Button */}
          <Link href="/signup" className="mb-4 block w-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 py-4 text-center text-lg font-semibold text-white transition-all hover:shadow-lg hover:scale-105">
            Create new account
          </Link>

          {/* Use Another Profile */}
          <Link href="/login" className="block text-center text-sm text-gray-400 transition-colors hover:text-white">
            Use another profile
          </Link>

          {/* Invite-only Notice */}
          {settings?.requireInvite && (
            <div className="mt-6 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-center">
              <p className="text-sm font-medium text-cyan-400">Invite-only access is active</p>
              <p className="mt-1 text-xs text-gray-400">
                {settings.inviteOnlyMessage}
              </p>
            </div>
          )}

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-gray-500">
            © 2026 Kinet. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}