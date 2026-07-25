"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase";
import {
  getCurrentUserProfile,
  saveUserProfile,
  type KinetRole,
} from "@/lib/user-profile";

const allowedRoles: KinetRole[] = ["athlete", "coach", "scout", "fan"];

export default function CompleteProfileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const defaultRole = allowedRoles.includes(roleParam as KinetRole)
    ? (roleParam as KinetRole)
    : "athlete";

  const [formData, setFormData] = useState({
    role: defaultRole,
    sport: "",
    position: "",
    age: "",
    height: "",
    location: "",
    bio: "",
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth?.currentUser) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (!profile || cancelled) {
          return;
        }

        setFormData((prev) => ({
          ...prev,
          role: (profile.role?.type as KinetRole) || prev.role,
          sport: profile.role?.sport || "",
          position: profile.role?.position || "",
          age: profile.role?.age ? String(profile.role.age) : "",
          height: profile.role?.height || "",
          location: profile.location || "",
          bio: profile.role?.bio || "",
        }));
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!formData.sport.trim()) {
      setError("Please add your main sport.");
      return;
    }

    if (!formData.bio.trim()) {
      setError("Please add a short bio.");
      return;
    }

    setSubmitting(true);

    try {
      await saveUserProfile({
        role: formData.role,
        sport: formData.sport,
        position: formData.position,
        age: formData.age ? Number(formData.age) : undefined,
        height: formData.height,
        location: formData.location,
        bio: formData.bio,
      });
      router.push("/feed");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save your profile."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserCircle2 className="h-8 w-8" />
          </div>
          <CardTitle>Complete your profile</CardTitle>
          <CardDescription>
            Add the details people will see when they discover you on Kinet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="sport" className="text-sm font-medium">
                  Sport
                </label>
                <Input
                  id="sport"
                  value={formData.sport}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      sport: event.target.value,
                    }))
                  }
                  placeholder="Basketball"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="position" className="text-sm font-medium">
                  Position
                </label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      position: event.target.value,
                    }))
                  }
                  placeholder="Point Guard"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="age" className="text-sm font-medium">
                  Age
                </label>
                <Input
                  id="age"
                  type="number"
                  min="0"
                  value={formData.age}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      age: event.target.value,
                    }))
                  }
                  placeholder="18"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="height" className="text-sm font-medium">
                  Height
                </label>
                <Input
                  id="height"
                  value={formData.height}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      height: event.target.value,
                    }))
                  }
                  placeholder={'6"2'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="location" className="text-sm font-medium">
                Location
              </label>
              <Input
                id="location"
                value={formData.location}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    location: event.target.value,
                  }))
                }
                placeholder="Atlanta, GA"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="bio" className="text-sm font-medium">
                Bio
              </label>
              <textarea
                id="bio"
                value={formData.bio}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    bio: event.target.value,
                  }))
                }
                placeholder="Tell coaches, scouts, and fans what you're about."
                className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting ? "Saving profile..." : "Finish setup"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
