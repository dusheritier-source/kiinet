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