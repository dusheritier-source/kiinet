"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    router.replace(searchParams.get("next") || "/feed");
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 py-12 px-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <h1 className="text-3xl font-bold gradient-text">Kinet</h1>
          </div>
          <CardTitle className="text-2xl text-center">Authentication is disabled</CardTitle>
          <CardDescription className="text-center">
            Sign-in is currently turned off while we reset the auth flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" onClick={() => router.replace(searchParams.get("next") || "/feed")} type="button">
            Continue to the app
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            <Link href="/feed" className="text-primary hover:underline font-medium">
              Go to feed instead
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
