"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/feed");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary/20 to-primary/10 py-12 px-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-6">
            <UserPlus className="h-12 w-12 text-primary mr-3" />
            <h1 className="text-3xl font-bold gradient-text">Join Kinet</h1>
          </div>
          <CardTitle className="text-2xl text-center">Sign-up is disabled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Account creation is temporarily turned off while we reset the auth flow.
          </p>
          <Button className="w-full" onClick={() => router.replace("/feed")} type="button">
            Continue to the app
          </Button>
          <div className="text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
