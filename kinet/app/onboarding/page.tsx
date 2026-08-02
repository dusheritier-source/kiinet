"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, AtSign, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveUserProfile } from "@/lib/user-profile";
import type { KinetRole } from "@/lib/user-profile";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    displayName: "",
    username: "",
    role: "athlete" as KinetRole,
    sport: "",
  });

  useEffect(() => {
    const storedName = window.localStorage.getItem("kinet-display-name") || "";
    if (storedName) {
      setFormData((prev) => ({ ...prev, displayName: storedName }));
    }
  }, []);

  const handleUsernameChange = (value: string) => {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    setFormData((prev) => ({ ...prev, username: normalized }));
  };

  const handleSubmit = async () => {
    setError("");

    if (!formData.displayName.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!formData.username.trim()) {
      setError("Please enter a username.");
      return;
    }

    if (!formData.sport.trim()) {
      setError("Please enter your sport.");
      return;
    }

    setIsSubmitting(true);
    try {
      window.localStorage.setItem("kinet-display-name", formData.displayName.trim());

      await saveUserProfile({
        role: formData.role,
        sport: formData.sport.trim(),
        bio: "",
        username: formData.username,
      });

      router.push("/feed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete onboarding. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 py-12 px-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <User className="h-12 w-12 text-primary mr-3" />
              <div>
                <CardTitle className="text-2xl">Welcome to Kinet!</CardTitle>
                <CardDescription>Let's set up your profile</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-sm font-medium">
                Your Name <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="displayName"
                  type="text"
                  placeholder="John Doe"
                  value={formData.displayName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
                  className="pl-10"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-xs text-muted-foreground">This is how your name will appear on posts and comments.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Username <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={formData.username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="pl-10"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Your unique handle: @{formData.username || "username"}
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              className="w-full"
              onClick={() => {
                if (!formData.displayName.trim() || !formData.username.trim()) {
                  setError("Please fill in all fields.");
                  return;
                }
                setStep(2);
              }}
              disabled={isSubmitting}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 py-12 px-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-primary mr-3" />
            <div>
              <CardTitle className="text-2xl">Almost there!</CardTitle>
              <CardDescription>Tell us about your sports journey</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="role" className="text-sm font-medium">
              I am a... <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["athlete", "coach", "scout", "fan"] as const).map((role) => (
                <Button
                  key={role}
                  type="button"
                  variant={formData.role === role ? "default" : "outline"}
                  className="capitalize"
                  onClick={() => setFormData((prev) => ({ ...prev, role }))}
                  disabled={isSubmitting}
                >
                  {role}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="sport" className="text-sm font-medium">
              Primary Sport <span className="text-destructive">*</span>
            </label>
            <Input
              id="sport"
              type="text"
              placeholder="e.g., Basketball, Soccer, Tennis"
              value={formData.sport}
              onChange={(e) => setFormData((prev) => ({ ...prev, sport: e.target.value }))}
              required
              disabled={isSubmitting}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setStep(1)}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Setting up..." : "Complete Setup"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}