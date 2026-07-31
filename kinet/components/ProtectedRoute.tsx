"use client";

import { useRouter } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRouteInner({ children }: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-cyan-400" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  return (
    <SessionProvider>
      <ProtectedRouteInner>{children}</ProtectedRouteInner>
    </SessionProvider>
  );
}