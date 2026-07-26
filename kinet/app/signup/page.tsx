"use client";

import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, User, UserPlus } from "lucide-react";
import Link from "next/link";
import { getAppAccessSettings, redeemInviteCode, validateInviteCode } from "@/lib/admin";
import { auth, firebaseConfigError, isFirebaseConfigured } from "@/lib/firebase";

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    inviteCode: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requireInvite, setRequireInvite] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");

  useEffect(() => {
    void getAppAccessSettings().then((settings) => {
      setRequireInvite(settings.requireInvite);
      setInviteMessage(settings.inviteOnlyMessage);
    });
  }, []);

  const getSignupErrorMessage = (err: unknown) => {
    if (err && typeof err === "object" && "code" in err) {
      const code = String((err as { code: string }).code);
      if (code === "auth/email-already-in-use") return "That email is already in use.";
      if (code === "auth/invalid-email") return "Please enter a valid email address.";
      if (code === "auth/weak-password") return "Password should be at least 6 characters.";
      if (code === "auth/network-request-failed") return "Network error. Check your connection and try again.";
    }
    return "Signup failed. Please try again.";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isFirebaseConfigured || !auth) {
      setError(firebaseConfigError ?? "Firebase is not configured.");
      return;
    }

    if (!formData.fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!formData.email.trim() || !formData.password) {
      setError("Please fill in email and password.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password should be at least 6 characters.");
      return;
    }

    if (requireInvite) {
      const inviteStatus = await validateInviteCode(formData.inviteCode);
      if (!inviteStatus.valid) {
        setError(inviteStatus.reason);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const credentials = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password
      );

      await updateProfile(credentials.user, {
        displayName: formData.fullName.trim(),
      });

      if (requireInvite) {
        await redeemInviteCode(formData.inviteCode, credentials.user.uid);
      }

      router.push("/feed");
    } catch (err) {
      setError(getSignupErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary/20 to-primary/10 py-12 px-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-6">
            <UserPlus className="h-12 w-12 text-primary mr-3" />
            <h1 className="text-3xl font-bold gradient-text">Join Kinet</h1>
          </div>
          <CardTitle className="text-2xl text-center">Create account</CardTitle>
          <CardDescription className="text-center">
            Join the sports community and showcase your talent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="fullName" className="text-sm font-medium">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="pl-10"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
            {requireInvite ? (
              <div className="space-y-2">
                <label htmlFor="inviteCode" className="text-sm font-medium">
                  Invite Code
                </label>
                <Input
                  id="inviteCode"
                  type="text"
                  placeholder="HOOP-ACCESS"
                  value={formData.inviteCode}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                />
                {inviteMessage ? (
                  <p className="text-xs text-muted-foreground">{inviteMessage}</p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="********"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="pl-10"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or sign up with
              </span>
            </div>
          </div>
          <Button variant="outline" className="w-full" disabled>
            Continue with Google
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
