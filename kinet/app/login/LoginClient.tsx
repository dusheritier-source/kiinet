"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
} from "firebase/auth";
import { Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth, db, firebaseConfigError, isFirebaseConfigured } from "@/lib/firebase";
import { recordLoginActivity } from "@/lib/phase8";
import { getDoc, doc } from "firebase/firestore";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkMessage, setMagicLinkMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const hasCheckedMagicLink = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !auth || hasCheckedMagicLink.current) {
      if (!hasCheckedMagicLink.current) {
        hasCheckedMagicLink.current = true;
        setIsLoading(false);
      }
      return;
    }

    hasCheckedMagicLink.current = true;

    try {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        setIsLoading(false);
        return;
      }

      const storedEmail = window.localStorage.getItem("Kinet_magic_email");
      if (!storedEmail) {
        setIsLoading(false);
        return;
      }

      setIsSubmitting(true);
      setError("");
      void signInWithEmailLink(auth, storedEmail, window.location.href)
        .then(async () => {
          window.localStorage.removeItem("Kinet_magic_email");
          await recordLoginActivity({
            email: storedEmail,
            method: "magic_link",
            deviceLabel: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "Browser",
          });
          router.push(searchParams.get("next") || "/feed");
        })
        .catch((err: unknown) => {
          setError(getLoginErrorMessage(err));
          setIsLoading(false);
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    } catch (err) {
      console.error("Magic link error:", err);
      setIsSubmitting(false);
      setIsLoading(false);
    }
  }, [router, searchParams]);

  const getLoginErrorMessage = (err: unknown) => {
    if (err && typeof err === "object" && "code" in err) {
      const code = String((err as { code: string }).code);
      if (code === "auth/invalid-email") return "Please enter a valid email address.";
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        return "Invalid email or password.";
      }
      if (code === "auth/wrong-password") return "Invalid email or password.";
      if (code === "auth/too-many-requests") return "Too many attempts. Try again later.";
      if (code === "auth/network-request-failed") return "Network error. Check your connection and try again.";
      if (code === "auth/popup-closed-by-user") return "Sign-in popup was closed. Please try again.";
      if (code === "auth/popup-blocked") return "Popup was blocked. Please allow popups for this site.";
      if (code === "auth/account-exists-with-different-credential") return "An account already exists with this email using a different sign-in method.";
      if (code === "auth/operation-not-allowed") return "Google sign-in is not enabled. Please contact support.";
      if (code === "auth/unauthorized-domain") return "This domain is not authorized for Google sign-in.";
      return `Error: ${code}`;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return "Login failed. Please try again.";
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!isFirebaseConfigured || !auth) {
      setError(firebaseConfigError ?? "Firebase is not configured.");
      return;
    }

    if (!email.trim() || !password) {
      setError("Please enter email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("Login attempt for:", email.trim());
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log("Login successful:", userCredential.user.uid);
      await recordLoginActivity({
        email: email.trim(),
        method: "password",
        deviceLabel: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "Browser",
      });
      router.push(searchParams.get("next") || "/feed");
    } catch (err) {
      console.error("Login failed:", err);
      setError(getLoginErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMagicLink = async () => {
    setError("");
    setMagicLinkMessage("");

    if (!isFirebaseConfigured || !auth) {
      setError(firebaseConfigError ?? "Firebase is not configured.");
      return;
    }

    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }

    setIsSubmitting(true);
    try {
      await sendSignInLinkToEmail(auth, email.trim(), {
        url:
          typeof window !== "undefined"
            ? `${window.location.origin}/login${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next") ?? "")}` : ""}`
            : "http://localhost:3000/login",
        handleCodeInApp: true,
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("Kinet_magic_email", email.trim());
      }
      setMagicLinkMessage("Magic link sent. Open it from your inbox on this device to finish sign-in.");
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setMagicLinkMessage("");

    if (!isFirebaseConfigured || !auth) {
      setError(firebaseConfigError ?? "Firebase is not configured.");
      return;
    }

    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("email");
      provider.addScope("profile");
      const result = await signInWithPopup(auth, provider);
      console.log("Google sign-in successful:", result.user);
      
      // Check if this is a new user (no profile in Firestore yet)
      if (db && result.user) {
        const userDoc = await getDoc(doc(db, "users", result.user.uid));
        if (!userDoc.exists()) {
          // New user - redirect to onboarding
          router.push("/onboarding");
          return;
        }
      }
      
      router.push(searchParams.get("next") || "/feed");
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError(getLoginErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 py-12 px-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <h1 className="text-3xl font-bold gradient-text">Kinet</h1>
          </div>
          <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">Sign in to your account to continue to your feed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(event) => {
                    setError("");
                    setEmail(event.target.value);
                  }}
                  className="pl-10"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(event) => {
                    setError("");
                    setPassword(event.target.value);
                  }}
                  className="pl-10"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {magicLinkMessage ? <p className="text-sm text-primary">{magicLinkMessage}</p> : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
            <Button type="button" variant="outline" className="w-full" disabled={isSubmitting} onClick={() => void handleMagicLink()}>
              Email me a magic link
            </Button>
          </form>
          <div className="text-center text-sm text-muted-foreground">
            <Link href="/forgot-password" className="hover:text-primary">
              Forgot your password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
          <Button variant="outline" className="w-full" disabled={isSubmitting} onClick={() => void handleGoogleSignIn()} type="button">
            Google
          </Button>
          <div className="text-center text-sm">
            Don&apos;t have an account? <Link href="/signup" className="text-primary hover:underline font-medium">Sign up</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
