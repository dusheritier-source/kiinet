"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ProfileError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Profile page error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">We couldn&apos;t open your profile</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your account is safe. Retry loading the latest profile information.</p>
      <Button className="mt-5" onClick={reset}>Retry profile</Button>
    </div>
  );
}
